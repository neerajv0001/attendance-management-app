import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { UserRole } from '@/lib/types';
import { getSessionUser } from '@/lib/auth';

const toMinutes = (time: string): number => {
    const match = /^(\d{2}):(\d{2})$/.exec(time);
    if (!match) return Number.NaN;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return Number.NaN;
    return (hours * 60) + minutes;
};

const hasTimeOverlap = (startA: string, endA: string, startB: string, endB: string): boolean => {
    const aStart = toMinutes(startA);
    const aEnd = toMinutes(endA);
    const bStart = toMinutes(startB);
    const bEnd = toMinutes(endB);
    if ([aStart, aEnd, bStart, bEnd].some(Number.isNaN)) return false;
    return aStart < bEnd && bStart < aEnd;
};

export async function GET(req: Request) {
    const session = await getSessionUser();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const scope = searchParams.get('scope');
    const timetable = await db.timetable.getAll();

    if (scope === 'all') {
        if (session.role !== UserRole.TEACHER && session.role !== UserRole.ADMIN && session.role !== UserRole.STUDENT) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        const users = await db.users.getAll();
        const teacherNameById = new Map(
            users
                .filter((u) => u.role === UserRole.TEACHER)
                .map((u) => [u.id, u.name || u.username || u.id] as const)
        );
        return NextResponse.json(
            timetable.map((entry) => ({
                ...entry,
                teacherName: teacherNameById.get(entry.teacherId || '') || entry.teacherId || 'N/A',
            }))
        );
    }

    if (session.role === UserRole.TEACHER) {
        return NextResponse.json(timetable.filter((entry) => entry.teacherId === session.id));
    }

    return NextResponse.json(timetable);
}

export async function POST(req: Request) {
    try {
        const session = await getSessionUser();
        if (!session || session.role !== UserRole.TEACHER) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { subject, day, startTime, endTime } = await req.json();
        if (!subject || !day || !startTime || !endTime) {
            return NextResponse.json({ error: 'Subject, day and time are required' }, { status: 400 });
        }
        const startMinutes = toMinutes(startTime);
        const endMinutes = toMinutes(endTime);
        if (Number.isNaN(startMinutes) || Number.isNaN(endMinutes) || startMinutes >= endMinutes) {
            return NextResponse.json({ error: 'Invalid time range' }, { status: 400 });
        }

        const current = await db.timetable.getAll();
        const conflicting = current.find((entry) =>
            entry.day === day && hasTimeOverlap(startTime, endTime, entry.startTime, entry.endTime)
        );
        if (conflicting) {
            const users = await db.users.getAll();
            const conflictTeacher = users.find((u) => u.id === conflicting.teacherId);
            const teacherName = conflictTeacher?.name || conflicting.teacherId || 'Another teacher';
            return NextResponse.json({
                error: `Time conflict: ${teacherName} already has class on ${day} from ${conflicting.startTime} to ${conflicting.endTime}.`,
            }, { status: 409 });
        }

        const newEntry = {
            id: `tt-${Date.now()}`,
            subject,
            day,
            startTime,
            endTime,
            teacherId: session.id,
            isCancelled: false,
        };

        await db.timetable.save([...current, newEntry]);

        return NextResponse.json({ success: true, entry: newEntry });
    } catch (error) {
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const session = await getSessionUser();
        if (!session || session.role !== UserRole.TEACHER) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id, isCancelled, cancelReason, subject, day, startTime, endTime } = await req.json();
        if (!id) return NextResponse.json({ error: 'Missing or invalid payload' }, { status: 400 });

        const current = await db.timetable.getAll();
        const idx = current.findIndex((entry) => entry.id === id);
        if (idx === -1) {
            return NextResponse.json({ error: 'Timetable entry not found' }, { status: 404 });
        }

        const existing = current[idx];
        if (existing.teacherId !== session.id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const hasCancelToggle = typeof isCancelled === 'boolean';
        const hasScheduleUpdate = [subject, day, startTime, endTime].some(v => typeof v === 'string');
        if (!hasCancelToggle && !hasScheduleUpdate) {
            return NextResponse.json({ error: 'No changes provided' }, { status: 400 });
        }

        const nextDay = typeof day === 'string' ? day.trim() : existing.day;
        const nextStartTime = typeof startTime === 'string' ? startTime : existing.startTime;
        const nextEndTime = typeof endTime === 'string' ? endTime : existing.endTime;
        const nextStartMinutes = toMinutes(nextStartTime);
        const nextEndMinutes = toMinutes(nextEndTime);
        if (Number.isNaN(nextStartMinutes) || Number.isNaN(nextEndMinutes) || nextStartMinutes >= nextEndMinutes) {
            return NextResponse.json({ error: 'Invalid time range' }, { status: 400 });
        }

        const conflicting = current.find((entry) =>
            entry.id !== existing.id
            && entry.day === nextDay
            && hasTimeOverlap(nextStartTime, nextEndTime, entry.startTime, entry.endTime)
        );
        if (conflicting) {
            const users = await db.users.getAll();
            const conflictTeacher = users.find((u) => u.id === conflicting.teacherId);
            const teacherName = conflictTeacher?.name || conflicting.teacherId || 'Another teacher';
            return NextResponse.json({
                error: `Time conflict: ${teacherName} already has class on ${nextDay} from ${conflicting.startTime} to ${conflicting.endTime}.`,
            }, { status: 409 });
        }

        const nextEntry = {
            ...existing,
            subject: typeof subject === 'string' ? subject.trim() : existing.subject,
            day: nextDay,
            startTime: nextStartTime,
            endTime: nextEndTime,
            isCancelled: hasCancelToggle ? isCancelled : existing.isCancelled,
            cancelledAt: hasCancelToggle
                ? (isCancelled ? new Date().toISOString() : undefined)
                : existing.cancelledAt,
            cancelReason: hasCancelToggle
                ? (isCancelled ? (typeof cancelReason === 'string' ? cancelReason.trim() : '') : undefined)
                : existing.cancelReason,
        };

        const next = [...current];
        next[idx] = nextEntry;
        await db.timetable.save(next);

        return NextResponse.json({ success: true, entry: nextEntry });
    } catch (error) {
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const session = await getSessionUser();
        if (!session || session.role !== UserRole.TEACHER) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await req.json();
        if (!id) {
            return NextResponse.json({ error: 'Missing timetable id' }, { status: 400 });
        }

        const current = await db.timetable.getAll();
        const target = current.find((entry) => entry.id === id);
        if (!target) {
            return NextResponse.json({ error: 'Timetable entry not found' }, { status: 404 });
        }
        if (target.teacherId !== session.id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        const next = current.filter((entry) => entry.id !== id);
        await db.timetable.save(next);

        return NextResponse.json({ success: true, id });
    } catch (error) {
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}

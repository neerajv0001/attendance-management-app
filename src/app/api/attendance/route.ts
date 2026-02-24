import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { UserRole } from '@/lib/types';
import { getSessionUser } from '@/lib/auth';

const isValidStatus = (status: any): status is 'PRESENT' | 'ABSENT' =>
    status === 'PRESENT' || status === 'ABSENT';

const normalizeKeyPart = (value: unknown, fallback: string) => {
    const text = typeof value === 'string' ? value.trim() : '';
    return text || fallback;
};

const getAttendanceKey = (record: any) => {
    const subjectKey = normalizeKeyPart(record?.subject, '__NO_SUBJECT__');
    const teacherKey = normalizeKeyPart(record?.teacherId, '__NO_TEACHER__');
    return `${record?.date}__${record?.studentId}__${subjectKey}__${teacherKey}`;
};

const normalizeAttendanceRecords = (records: any[]) => {
    // Keep one record per student + date + subject + teacher (latest wins).
    const map = new Map<string, any>();
    for (const r of records || []) {
        if (!r?.date || !r?.studentId || !isValidStatus(r?.status)) continue;
        const key = getAttendanceKey(r);
        map.set(key, {
            date: r.date,
            studentId: r.studentId,
            status: r.status,
            teacherId: r.teacherId,
            subject: r.subject,
            teacherName: r.teacherName,
        });
    }
    return Array.from(map.values());
};

export async function POST(req: Request) {
    try {
        const session = await getSessionUser();
        if (!session || session.role !== UserRole.TEACHER) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { date, records } = await req.json(); // records: { studentId: string, status: 'PRESENT' | 'ABSENT' }[]

        if (!date || !records || !Array.isArray(records)) {
            return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
        }

        const users = await db.users.getAll();
        const teacherUser = users.find((u: any) => u.id === session.id);
        const currentRecords = await db.attendance.getAll();

        const newRecords = normalizeAttendanceRecords(records.map((r: any) => ({
            date,
            studentId: r?.studentId,
            status: r?.status,
            teacherId: session.id,
            subject: normalizeKeyPart(r?.subject, normalizeKeyPart(teacherUser?.subject, 'General')),
            teacherName: normalizeKeyPart(r?.teacherName, normalizeKeyPart(teacherUser?.name, session.id)),
        })));

        if (newRecords.length === 0) {
            return NextResponse.json({ error: 'No valid attendance records provided' }, { status: 400 });
        }

        const incomingKeys = new Set(newRecords.map((r: any) => getAttendanceKey(r)));
        const filtered = normalizeAttendanceRecords(currentRecords.filter((r: any) => !incomingKeys.has(getAttendanceKey(r))));

        // Save combined set (filtered existing + new records)
        await db.attendance.save(normalizeAttendanceRecords([...filtered, ...newRecords]));

        return NextResponse.json({ success: true, message: 'Attendance marked' });
    } catch (error) {
        console.error('Attendance error:', error);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}

export async function GET(req: Request) {
    const session = await getSessionUser();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    let studentId = searchParams.get('studentId');

    // If student role, force query to own ID
    if (session.role === UserRole.STUDENT) {
        studentId = session.id;
    }

    const records = normalizeAttendanceRecords(await db.attendance.getAll());
    const users = await db.users.getAll();
    const teacherNameById = new Map(
        users
            .filter((u: any) => u?.role === UserRole.TEACHER)
            .map((u: any) => [u.id, u.name || u.username || u.id])
    );
    const teacherSubjectById = new Map(
        users
            .filter((u: any) => u?.role === UserRole.TEACHER)
            .map((u: any) => [u.id, u.subject || 'General'])
    );

    const enriched = records.map((r: any) => ({
        ...r,
        teacherName: r.teacherName || teacherNameById.get(r.teacherId) || r.teacherId || '',
        subject: r.subject || teacherSubjectById.get(r.teacherId) || 'General',
    }));

    if (studentId) {
        return NextResponse.json(
            enriched
                .filter((r: any) => r.studentId === studentId)
                .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
        );
    }

    if (session.role === UserRole.TEACHER) {
        return NextResponse.json(
            enriched
                .filter((r: any) => r.teacherId === session.id)
                .sort((a: any, b: any) => {
                    if (a.date === b.date) return (a.studentId || '').localeCompare(b.studentId || '');
                    return a.date < b.date ? 1 : -1;
                })
        );
    }

    if (session.role === UserRole.ADMIN) {
        return NextResponse.json(
            enriched.sort((a: any, b: any) => {
                if (a.date === b.date) return (a.studentId || '').localeCompare(b.studentId || '');
                return a.date < b.date ? 1 : -1;
            })
        );
    }

    return NextResponse.json([]);
}

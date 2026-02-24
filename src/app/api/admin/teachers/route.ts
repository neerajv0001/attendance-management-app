import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { UserRole } from '@/lib/types';
import { getSessionUser } from '@/lib/auth';

export async function GET(req: Request) {
    const session = await getSessionUser();
    if (!session || session.role !== UserRole.ADMIN) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status'); // 'pending' or 'approved'

    const users = await db.users.getAll();
    let teachers = users.filter((u) => u.role === UserRole.TEACHER);

    if (status === 'pending') {
        teachers = teachers.filter((u) => !u.isApproved);
    } else if (status === 'approved') {
        teachers = teachers.filter((u) => u.isApproved);
    }

    return NextResponse.json(teachers);
}

export async function DELETE(req: Request) {
    try {
        const session = await getSessionUser();
        if (!session || session.role !== UserRole.ADMIN) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await req.json();
        if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

        await db.users.delete(id);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Delete teacher error:', error);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const session = await getSessionUser();
        if (!session || session.role !== UserRole.ADMIN) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id, name, email, subject, experience, qualification, phone } = await req.json();
        if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

        const users = await db.users.getAll();
        const teacher = users.find((u) => u.id === id && u.role === UserRole.TEACHER);
        if (!teacher) {
            return NextResponse.json({ error: 'Teacher not found' }, { status: 404 });
        }

        const updated = await db.users.update(id, {
            name: typeof name === 'string' ? name.trim() : teacher.name,
            email: typeof email === 'string' ? email.trim() : teacher.email,
            subject: typeof subject === 'string' ? subject.trim() : teacher.subject,
            experience: typeof experience === 'string' ? experience.trim() : teacher.experience,
            qualification: typeof qualification === 'string' ? qualification.trim() : teacher.qualification,
            phone: typeof phone === 'string' ? phone.trim() : teacher.phone,
        } as any);

        return NextResponse.json({ success: true, teacher: updated });
    } catch (error) {
        console.error('Update teacher error:', error);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}

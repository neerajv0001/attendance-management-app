import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import bcrypt from 'bcryptjs';

// Update password
export async function PUT(req: Request) {
    try {
        const session = await getSessionUser();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { currentPassword, newPassword, newUsername } = await req.json();
        const users = await db.users.getAll();
        const user = users.find(u => u.id === session.id);

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // If changing password
        if (newPassword) {
            if (!currentPassword) {
                return NextResponse.json({ error: 'Current password is required' }, { status: 400 });
            }

            const validPassword = await bcrypt.compare(currentPassword, user.passwordHash);
            if (!validPassword) {
                return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
            }

            const hashedPassword = await bcrypt.hash(newPassword, 10);
            await db.users.update(session.id, { passwordHash: hashedPassword });
        }

        // If changing username
        if (newUsername) {
            // Check if username is already taken
            const existingUser = users.find(u => u.username === newUsername && u.id !== session.id);
            if (existingUser) {
                return NextResponse.json({ error: 'Username already taken' }, { status: 400 });
            }

            await db.users.update(session.id, { username: newUsername });
        }

        return NextResponse.json({
            success: true,
            message: 'Settings updated successfully'
        });
    } catch (error) {
        console.error('Settings update error:', error);
        return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
    }
}

// Get current user info
export async function GET() {
    try {
        const session = await getSessionUser();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const users = await db.users.getAll();
        const user = users.find(u => u.id === session.id);

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        return NextResponse.json({
            id: user.id,
            username: user.username,
            name: user.name,
            email: user.email,
            role: user.role,
            subject: user.subject,
            courseId: user.courseId
        });
    } catch (error) {
        console.error('Get user error:', error);
        return NextResponse.json({ error: 'Failed to get user info' }, { status: 500 });
    }
}

// Delete current user (permanent)
export async function DELETE() {
    try {
        const session = await getSessionUser();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Remove user from DB (or fallback JSON)
        await db.users.delete(session.id);

        // Optionally, clear any server-side sessions/cookies here. Client should call /api/auth/logout
        return NextResponse.json({ success: true, message: 'Account deleted' });
    } catch (error) {
        console.error('Delete user error:', error);
        return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
    }
}

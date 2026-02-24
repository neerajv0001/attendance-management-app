import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { UserRole } from '@/lib/types';
import bcrypt from 'bcryptjs';

export async function POST(req: Request) {
    try {
        const { name, email, phone, qualification, experience, subject, courseId, password } = await req.json();

        if (!name || !email || !phone || !qualification || !experience || !subject || !courseId || !password) {
            return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
            return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 });
        }

        if (!/^\d{10}$/.test(String(phone))) {
            return NextResponse.json({ error: 'Phone Number must be exactly 10 digits' }, { status: 400 });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const id = `teacher-${Date.now()}`;

        const newTeacher = {
            id,
            username: email, // Email as username for teachers
            passwordHash: hashedPassword,
            role: UserRole.TEACHER,
            name,
            email,
            phone,
            qualification,
            experience,
            subject,
            courseId,
            isApproved: false, // Wait for admin
            createdAt: new Date().toISOString(),
        };

        const savedUser = await db.users.create(newTeacher);

        return NextResponse.json({ success: true, message: 'Teacher registered successfully. Wait for admin approval.' });
    } catch (error) {
        console.error('Registration error:', error);
        return NextResponse.json({ error: 'Registration failed' }, { status: 500 });
    }
}

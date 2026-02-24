import { User, UserRole, Course, AttendanceRecord, TimetableEntry } from './types';
import bcrypt from 'bcryptjs';
import fs from 'fs/promises';
import path from 'path';
import connectDB, { isMongoAvailable } from './mongodb';
import { User as UserModel, Course as CourseModel, AttendanceRecord as AttendanceModel, TimetableEntry as TimetableModel } from './models';
import { Notice as NoticeModel } from './models';

export const db = {
    users: {
        getAll: async (): Promise<User[]> => {
            try {
                const conn = await connectDB();
                if (!conn || !isMongoAvailable()) throw new Error('Mongo unavailable');
                const users = await UserModel.find().lean();
                return users.map(u => ({
                    id: u.id,
                    username: u.username,
                    passwordHash: u.passwordHash,
                    role: u.role as UserRole,
                    name: u.name,
                    email: u.email,
                    phone: u.phone,
                    isApproved: u.isApproved,
                    subject: u.subject,
                    qualification: u.qualification,
                    experience: u.experience,
                    department: u.department,
                    courseId: u.courseId,
                    createdAt: (u.createdAt instanceof Date)
                        ? u.createdAt.toISOString()
                        : (typeof u.createdAt === 'string' ? u.createdAt : new Date(u.createdAt).toISOString()),
                }));
            } catch (err) {
                console.error('MongoDB unavailable, falling back to data/users.json:', err);
                const file = path.join(process.cwd(), 'data', 'users.json');
                try {
                    const text = await fs.readFile(file, 'utf-8');
                    const localUsers: any[] = JSON.parse(text || '[]');
                    return localUsers.map(u => ({
                        id: u.id,
                        username: u.username,
                        passwordHash: u.passwordHash,
                        role: u.role as UserRole,
                        name: u.name,
                        email: u.email,
                        phone: u.phone,
                        isApproved: u.isApproved,
                        subject: u.subject,
                        qualification: u.qualification,
                        experience: u.experience,
                        department: u.department,
                        courseId: u.courseId,
                        createdAt: typeof u.createdAt === 'string' ? u.createdAt : new Date(u.createdAt).toISOString(),
                    }));
                } catch (fileErr) {
                    console.error('Failed to read local users.json fallback:', fileErr);
                    return [];
                }
            }
        },
        save: async (users: User[]) => {
            await connectDB();
            // This is handled individually via create/update/delete
        },
        create: async (user: User) => {
            try {
                const conn = await connectDB();
                if (!conn || !isMongoAvailable()) throw new Error('Mongo unavailable');
                // Check if username already exists
                const existingUser = await UserModel.findOne({ username: user.username });
                if (existingUser) {
                    throw new Error('Username already exists');
                }
                await UserModel.create({
                    id: user.id,
                    username: user.username,
                    passwordHash: user.passwordHash,
                    role: user.role,
                    name: user.name,
                    email: user.email,
                    phone: user.phone,
                    isApproved: user.isApproved,
                    subject: user.subject,
                    qualification: user.qualification,
                    experience: user.experience,
                    department: user.department,
                    courseId: user.courseId,
                    createdAt: new Date(user.createdAt),
                });
                return user;
            } catch (err) {
                console.warn('MongoDB unavailable, creating user in data/users.json fallback:', err);
                const file = path.join(process.cwd(), 'data', 'users.json');
                try {
                    const text = await fs.readFile(file, 'utf-8');
                    const localUsers: any[] = JSON.parse(text || '[]');
                    if (localUsers.find(u => u.username === user.username)) {
                        throw new Error('Username already exists');
                    }
                    localUsers.unshift(user);
                    await fs.writeFile(file, JSON.stringify(localUsers, null, 2), 'utf-8');
                    return user;
                } catch (fileErr) {
                    console.error('Failed to create user in local fallback:', fileErr);
                    throw fileErr;
                }
            }
        },
        update: async (userId: string, updates: Partial<User>) => {
            try {
                const conn = await connectDB();
                if (!conn || !isMongoAvailable()) throw new Error('Mongo unavailable');
                const updateData: any = { ...updates };
                if (updates.createdAt) {
                    updateData.createdAt = new Date(updates.createdAt);
                }
                const user = await UserModel.findOneAndUpdate(
                    { id: userId },
                    updateData,
                    { new: true }
                ).lean();
                if (!user) throw new Error('User not found');
                return {
                    id: user.id,
                    username: user.username,
                    passwordHash: user.passwordHash,
                    role: user.role as UserRole,
                    name: user.name,
                    email: user.email,
                    phone: user.phone,
                    isApproved: user.isApproved,
                    subject: user.subject,
                    qualification: user.qualification,
                    experience: user.experience,
                    department: user.department,
                    courseId: user.courseId,
                    createdAt: (user.createdAt instanceof Date)
                        ? user.createdAt.toISOString()
                        : (typeof user.createdAt === 'string' ? user.createdAt : new Date(user.createdAt).toISOString()),
                };
            } catch (err) {
                console.warn('MongoDB unavailable, updating user in data/users.json fallback:', err);
                const file = path.join(process.cwd(), 'data', 'users.json');
                try {
                    const text = await fs.readFile(file, 'utf-8');
                    const localUsers: any[] = JSON.parse(text || '[]');
                    const idx = localUsers.findIndex(u => u.id === userId);
                    if (idx === -1) throw new Error('User not found');
                    localUsers[idx] = { ...localUsers[idx], ...updates };
                    await fs.writeFile(file, JSON.stringify(localUsers, null, 2), 'utf-8');
                    return localUsers[idx];
                } catch (fileErr) {
                    console.error('Failed to update user in local fallback:', fileErr);
                    throw fileErr;
                }
            }
        },
        delete: async (userId: string) => {
            try {
                const conn = await connectDB();
                if (!conn || !isMongoAvailable()) throw new Error('Mongo unavailable');
                await UserModel.deleteOne({ id: userId });
            } catch (err) {
                console.warn('MongoDB unavailable, deleting user in data/users.json fallback:', err);
                const file = path.join(process.cwd(), 'data', 'users.json');
                try {
                    const text = await fs.readFile(file, 'utf-8');
                    const localUsers: any[] = JSON.parse(text || '[]');
                    const filtered = localUsers.filter(u => u.id !== userId);
                    await fs.writeFile(file, JSON.stringify(filtered, null, 2), 'utf-8');
                } catch (fileErr) {
                    console.error('Failed to delete user in local fallback:', fileErr);
                    throw fileErr;
                }
            }
        },
        initAdmin: async () => {
            const conn = await connectDB();
            if (isMongoAvailable() && conn) {
                const adminExists = await UserModel.findOne({ role: UserRole.ADMIN });
                if (!adminExists) {
                    const hashedPassword = await bcrypt.hash('admin123', 10);
                    await UserModel.create({
                        id: 'admin-1',
                        username: 'admin',
                        passwordHash: hashedPassword,
                        role: UserRole.ADMIN,
                        name: 'System Admin',
                        createdAt: new Date(),
                    });
                    console.log('Admin user created: admin / admin123');
                }
                return;
            }

            // Fallback to local JSON file if MongoDB is not available
            try {
                const file = path.join(process.cwd(), 'data', 'users.json');
                const text = await fs.readFile(file, 'utf-8');
                const localUsers: any[] = JSON.parse(text || '[]');
                const admin = localUsers.find(u => u.role === UserRole.ADMIN);
                if (!admin) {
                    const hashedPassword = await bcrypt.hash('admin123', 10);
                    localUsers.unshift({
                        id: 'admin-1',
                        username: 'admin',
                        passwordHash: hashedPassword,
                        role: UserRole.ADMIN,
                        name: 'System Admin',
                        createdAt: new Date().toISOString(),
                    });
                    await fs.writeFile(file, JSON.stringify(localUsers, null, 2), 'utf-8');
                    console.log('Admin user added to data/users.json: admin / admin123');
                }
            } catch (fileErr) {
                console.error('Failed to ensure admin in local users.json:', fileErr);
            }
        },
    },
    courses: {
        getAll: async (): Promise<Course[]> => {
            try {
                const conn = await connectDB();
                if (!conn || !isMongoAvailable()) throw new Error('Mongo unavailable');
                const courses = await CourseModel.find().lean();
                return courses.map(c => ({
                    id: c.id,
                    name: c.name,
                    subjects: c.subjects,
                }));
            } catch (err) {
                console.error('MongoDB unavailable, falling back to data/courses.json:', err);
                const file = path.join(process.cwd(), 'data', 'courses.json');
                try {
                    const text = await fs.readFile(file, 'utf-8');
                    const localCourses: any[] = JSON.parse(text || '[]');
                    return localCourses.map(c => ({ id: c.id, name: c.name, subjects: c.subjects || [] }));
                } catch (fileErr) {
                    console.error('Failed to read local courses.json fallback:', fileErr);
                    return [];
                }
            }
        },
        save: async (courses: Course[]) => {
            try {
                await connectDB();
                await CourseModel.deleteMany({});
                if (courses.length > 0) {
                    await CourseModel.insertMany(courses);
                }
            } catch (err) {
                // fallback: persist to data/courses.json
                try {
                    const file = path.join(process.cwd(), 'data', 'courses.json');
                    await fs.writeFile(file, JSON.stringify(courses, null, 2), 'utf-8');
                } catch (fileErr) {
                    console.error('Failed to save courses to local file as fallback:', fileErr);
                }
            }
        },
    },
    attendance: {
        getAll: async (): Promise<AttendanceRecord[]> => {
            try {
                const conn = await connectDB();
                if (!conn || !isMongoAvailable()) throw new Error('Mongo unavailable');
                const records = await AttendanceModel.find().lean();
                return records.map(r => ({
                    date: r.date,
                    status: r.status,
                    studentId: r.studentId,
                    teacherId: r.teacherId,
                    subject: r.subject,
                    teacherName: r.teacherName,
                }));
            } catch (err) {
                console.error('MongoDB unavailable, falling back to data/attendance.json:', err);
                const file = path.join(process.cwd(), 'data', 'attendance.json');
                try {
                    const text = await fs.readFile(file, 'utf-8');
                    const local: any[] = JSON.parse(text || '[]');
                    return local.map(r => ({
                        date: r.date,
                        status: r.status,
                        studentId: r.studentId,
                        teacherId: r.teacherId,
                        subject: r.subject,
                        teacherName: r.teacherName,
                    }));
                } catch (fileErr) {
                    console.error('Failed to read local attendance.json fallback:', fileErr);
                    return [];
                }
            }
        },
        save: async (records: AttendanceRecord[]) => {
            try {
                const conn = await connectDB();
                if (!conn || !isMongoAvailable()) throw new Error('Mongo unavailable');
                await AttendanceModel.deleteMany({});
                if (records.length > 0) {
                    await AttendanceModel.insertMany(records);
                }
            } catch (err) {
                console.warn('MongoDB unavailable, saving attendance to data/attendance.json fallback:', err);
                const file = path.join(process.cwd(), 'data', 'attendance.json');
                try {
                    await fs.writeFile(file, JSON.stringify(records, null, 2), 'utf-8');
                } catch (fileErr) {
                    console.error('Failed to save attendance to local fallback:', fileErr);
                    throw fileErr;
                }
            }
        },
    },
    timetable: {
        getAll: async (): Promise<TimetableEntry[]> => {
            try {
                const conn = await connectDB();
                if (!conn || !isMongoAvailable()) throw new Error('Mongo unavailable');
                const entries = await TimetableModel.find().lean();
                return entries.map(e => ({
                    id: e.id,
                    subject: e.subject,
                    day: e.day,
                    startTime: e.startTime,
                    endTime: e.endTime,
                    teacherId: e.teacherId,
                    isCancelled: !!e.isCancelled,
                    cancelledAt: e.cancelledAt
                        ? (e.cancelledAt instanceof Date ? e.cancelledAt.toISOString() : new Date(e.cancelledAt).toISOString())
                        : undefined,
                    cancelReason: e.cancelReason,
                }));
            } catch (err) {
                console.error('MongoDB unavailable, falling back to data/timetable.json:', err);
                const file = path.join(process.cwd(), 'data', 'timetable.json');
                try {
                    const text = await fs.readFile(file, 'utf-8');
                    const local: any[] = JSON.parse(text || '[]');
                    return local.map(e => ({
                        id: e.id,
                        subject: e.subject,
                        day: e.day,
                        startTime: e.startTime,
                        endTime: e.endTime,
                        teacherId: e.teacherId,
                        isCancelled: !!e.isCancelled,
                        cancelledAt: e.cancelledAt,
                        cancelReason: e.cancelReason,
                    }));
                } catch (fileErr) {
                    console.error('Failed to read local timetable.json fallback:', fileErr);
                    return [];
                }
            }
        },
        save: async (timetable: TimetableEntry[]) => {
            try {
                const conn = await connectDB();
                if (!conn || !isMongoAvailable()) throw new Error('Mongo unavailable');
                await TimetableModel.deleteMany({});
                if (timetable.length > 0) {
                    await TimetableModel.insertMany(timetable);
                }
            } catch (err) {
                console.warn('MongoDB unavailable, saving timetable to data/timetable.json fallback:', err);
                const file = path.join(process.cwd(), 'data', 'timetable.json');
                try {
                    await fs.writeFile(file, JSON.stringify(timetable, null, 2), 'utf-8');
                } catch (fileErr) {
                    console.error('Failed to save timetable to local fallback:', fileErr);
                    throw fileErr;
                }
            }
        },
    }
};

// Notices are stored similarly to other resources with Mongo fallback to JSON file
db['notices'] = {
    getAll: async (): Promise<import('./types').Notice[]> => {
        try {
            const conn = await connectDB();
            if (!conn || !isMongoAvailable()) throw new Error('Mongo unavailable');
            const list = await NoticeModel.find().sort({ createdAt: -1 }).lean();
            return list.map(n => ({ id: n.id, title: n.title, message: n.message, authorId: n.authorId, createdAt: (n.createdAt instanceof Date) ? n.createdAt.toISOString() : new Date(n.createdAt).toISOString() }));
        } catch (err) {
            console.error('MongoDB unavailable, falling back to data/notices.json:', err);
            const file = path.join(process.cwd(), 'data', 'notices.json');
            try {
                const text = await fs.readFile(file, 'utf-8');
                const local: any[] = JSON.parse(text || '[]');
                return local.map(n => ({ id: n.id, title: n.title, message: n.message, authorId: n.authorId, createdAt: typeof n.createdAt === 'string' ? n.createdAt : new Date(n.createdAt).toISOString() }));
            } catch (fileErr) {
                console.error('Failed to read local notices.json fallback:', fileErr);
                return [];
            }
        }
    },
    create: async (notice: import('./types').Notice) => {
        try {
            const conn = await connectDB();
            if (!conn || !isMongoAvailable()) throw new Error('Mongo unavailable');
            await NoticeModel.create({ id: notice.id, title: notice.title, message: notice.message, authorId: notice.authorId, createdAt: new Date(notice.createdAt) });
            return notice;
        } catch (err) {
            console.warn('MongoDB unavailable, creating notice in data/notices.json fallback:', err);
            const file = path.join(process.cwd(), 'data', 'notices.json');
            try {
                const text = await fs.readFile(file, 'utf-8');
                const local: any[] = JSON.parse(text || '[]');
                local.unshift(notice);
                await fs.writeFile(file, JSON.stringify(local, null, 2), 'utf-8');
                return notice;
            } catch (fileErr) {
                console.error('Failed to create notice in local fallback:', fileErr);
                throw fileErr;
            }
        }
    },
    update: async (noticeId: string, updates: Partial<import('./types').Notice>) => {
        try {
            const conn = await connectDB();
            if (!conn || !isMongoAvailable()) throw new Error('Mongo unavailable');
            const updateData: any = { ...updates };
            if (updates.createdAt) updateData.createdAt = new Date(updates.createdAt);
            const doc = await NoticeModel.findOneAndUpdate({ id: noticeId }, updateData, { new: true }).lean();
            if (!doc) throw new Error('Notice not found');
            return { id: doc.id, title: doc.title, message: doc.message, authorId: doc.authorId, createdAt: (doc.createdAt instanceof Date) ? doc.createdAt.toISOString() : new Date(doc.createdAt).toISOString() };
        } catch (err) {
            console.warn('MongoDB unavailable, updating notice in data/notices.json fallback:', err);
            const file = path.join(process.cwd(), 'data', 'notices.json');
            try {
                const text = await fs.readFile(file, 'utf-8');
                const local: any[] = JSON.parse(text || '[]');
                const idx = local.findIndex(n => n.id === noticeId);
                if (idx === -1) throw new Error('Notice not found');
                local[idx] = { ...local[idx], ...updates };
                await fs.writeFile(file, JSON.stringify(local, null, 2), 'utf-8');
                return local[idx];
            } catch (fileErr) {
                console.error('Failed to update notice in local fallback:', fileErr);
                throw fileErr;
            }
        }
    },
    delete: async (noticeId: string) => {
        try {
            const conn = await connectDB();
            if (!conn || !isMongoAvailable()) throw new Error('Mongo unavailable');
            await NoticeModel.deleteOne({ id: noticeId });
        } catch (err) {
            console.warn('MongoDB unavailable, deleting notice in data/notices.json fallback:', err);
            const file = path.join(process.cwd(), 'data', 'notices.json');
            try {
                const text = await fs.readFile(file, 'utf-8');
                const local: any[] = JSON.parse(text || '[]');
                const filtered = local.filter(n => n.id !== noticeId);
                await fs.writeFile(file, JSON.stringify(filtered, null, 2), 'utf-8');
            } catch (fileErr) {
                console.error('Failed to delete notice in local fallback:', fileErr);
                throw fileErr;
            }
        }
    }
};

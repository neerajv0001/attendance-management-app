import mongoose, { Schema, Document } from 'mongoose';
import { UserRole } from './types';

// User Schema
export interface IUser extends Document {
    id: string;
    username: string;
    passwordHash: string;
    role: UserRole;
    name: string;
    email?: string;
    phone?: string;
    isApproved?: boolean;
    subject?: string;
    qualification?: string;
    experience?: string;
    department?: string;
    courseId?: string;
    createdAt: Date;
}

const UserSchema = new Schema<IUser>({
    id: { type: String, required: true, unique: true },
    username: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: Object.values(UserRole), required: true },
    name: { type: String, required: true },
    email: { type: String },
    phone: { type: String },
    isApproved: { type: Boolean, default: false },
    subject: { type: String },
    qualification: { type: String },
    experience: { type: String },
    department: { type: String },
    courseId: { type: String },
    createdAt: { type: Date, default: Date.now }
});

// Course Schema
export interface ICourse extends Document {
    id: string;
    name: string;
    subjects: string[];
}

const CourseSchema = new Schema<ICourse>({
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    subjects: [{ type: String }]
});

// Attendance Record Schema
export interface IAttendanceRecord extends Document {
    date: string;
    status: 'PRESENT' | 'ABSENT';
    studentId: string;
    teacherId?: string;
    subject?: string;
}

const AttendanceRecordSchema = new Schema<IAttendanceRecord>({
    date: { type: String, required: true },
    status: { type: String, enum: ['PRESENT', 'ABSENT'], required: true },
    studentId: { type: String, required: true },
    teacherId: { type: String }
    , subject: { type: String }
});

// Timetable Entry Schema
export interface ITimetableEntry extends Document {
    id: string;
    subject: string;
    day: string;
    startTime: string;
    endTime: string;
    teacherId: string;
    isCancelled?: boolean;
    cancelledAt?: Date;
    cancelReason?: string;
}

const TimetableEntrySchema = new Schema<ITimetableEntry>({
    id: { type: String, required: true, unique: true },
    subject: { type: String, required: true },
    day: { type: String, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    teacherId: { type: String, required: true },
    isCancelled: { type: Boolean, default: false },
    cancelledAt: { type: Date },
    cancelReason: { type: String }
});

// Export models (with check for existing models to avoid hot-reload issues)
export const User = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
export const Course = mongoose.models.Course || mongoose.model<ICourse>('Course', CourseSchema);
export const AttendanceRecord = mongoose.models.AttendanceRecord || mongoose.model<IAttendanceRecord>('AttendanceRecord', AttendanceRecordSchema);
export const TimetableEntry = mongoose.models.TimetableEntry || mongoose.model<ITimetableEntry>('TimetableEntry', TimetableEntrySchema);

// Notice Schema
export interface INotice extends Document {
    id: string;
    title: string;
    message: string;
    authorId?: string;
    createdAt: Date;
}

const NoticeSchema = new Schema<INotice>({
    id: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    authorId: { type: String },
    createdAt: { type: Date, default: Date.now }
});

export const Notice = mongoose.models.Notice || mongoose.model<INotice>('Notice', NoticeSchema);

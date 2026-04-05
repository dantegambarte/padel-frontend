export interface Teacher {
  id: string;
  fullName: string;
  phoneNumber: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTeacherDto {
  fullName: string;
  phoneNumber?: string;
}

export interface UpdateTeacherDto extends Partial<CreateTeacherDto> {
  isActive?: boolean;
}

export interface TeacherReportBooking {
  id: string;
  date: string;
  hour: string;
  durationMinutes: number;
  courtName: string;
  teacherAmount: number;
}

export interface TeacherReport {
  teacher: Teacher;
  period: { startDate: string; endDate: string };
  bookings: TeacherReportBooking[];
  summary: {
    totalBookings: number;
    totalMinutes: number;
    totalHours: number;
    totalAmount: number;
  };
}

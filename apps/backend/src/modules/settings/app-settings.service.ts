import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

/** Davomat qoidalari — web-admin "Sozlamalar"dan boshqariladi. */
export interface AttendanceSettings {
  /**
   * true  — keldi/ketdi faqat yuz mos kelsa VA joy to'g'ri bo'lsa qabul qilinadi.
   * false — yuz skaneri talab qilinmaydi: joy (ofis radiusi yoki biriktirilgan
   *         mahalla) to'g'ri bo'lsa belgi qabul qilinadi.
   */
  faceRequired: boolean;
}

export const DEFAULT_ATTENDANCE_SETTINGS: AttendanceSettings = { faceRequired: true };

const ATTENDANCE_KEY = 'attendance';
/** Each check-in reads the switch; a short cache keeps that off the database. */
const CACHE_MS = 15_000;

/** Tolerant read of whatever JSON is stored: unknown/missing fields fall back to defaults. */
export function normalizeAttendanceSettings(value: unknown): AttendanceSettings {
  const v = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    faceRequired:
      typeof v.faceRequired === 'boolean' ? v.faceRequired : DEFAULT_ATTENDANCE_SETTINGS.faceRequired,
  };
}

@Injectable()
export class AppSettingsService {
  private cache: { value: AttendanceSettings; at: number } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async attendance(): Promise<AttendanceSettings> {
    if (this.cache && Date.now() - this.cache.at < CACHE_MS) {
      return this.cache.value;
    }
    const row = await this.prisma.appSetting.findUnique({ where: { key: ATTENDANCE_KEY } });
    const value = normalizeAttendanceSettings(row?.value);
    this.cache = { value, at: Date.now() };
    return value;
  }

  async updateAttendance(patch: Partial<AttendanceSettings>): Promise<AttendanceSettings> {
    const current = await this.attendance();
    const next = normalizeAttendanceSettings({ ...current, ...patch });
    const value = next as unknown as Prisma.InputJsonValue;
    await this.prisma.appSetting.upsert({
      where: { key: ATTENDANCE_KEY },
      create: { key: ATTENDANCE_KEY, value },
      update: { value },
    });
    this.cache = { value: next, at: Date.now() };
    return next;
  }
}

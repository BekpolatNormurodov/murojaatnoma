import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Suggestion } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateSuggestionDto } from './dto/create-suggestion.dto';

interface SuggestionDto {
  id: string;
  title: string;
  body: string;
  category: string;
  status: string;
  created_at: string;
  votes: number;
}

/**
 * Employee rationalization suggestions (worker-app "Takliflar"). Matches the
 * client contract: GET /suggestions, POST /suggestions, POST /suggestions/:id/vote.
 * `status` serializes as the SuggestionStatus enum name (yangi|korilmoqda|...).
 */
@Injectable()
export class SuggestionsService {
  constructor(private readonly prisma: PrismaService) {}

  private toDto(s: Suggestion): SuggestionDto {
    return {
      id: s.id,
      title: s.title,
      body: s.body,
      category: s.category,
      status: s.status,
      created_at: s.createdAt.toISOString(),
      votes: s.votes,
    };
  }

  async list(): Promise<SuggestionDto[]> {
    const rows = await this.prisma.suggestion.findMany({
      orderBy: [{ votes: 'desc' }, { createdAt: 'desc' }],
      take: 200,
    });
    return rows.map((s) => this.toDto(s));
  }

  async create(employeeId: string, dto: CreateSuggestionDto): Promise<SuggestionDto> {
    const created = await this.prisma.suggestion.create({
      data: {
        authorId: employeeId,
        title: dto.title,
        body: dto.body,
        category: dto.category?.trim() ? dto.category : 'Umumiy',
      },
    });
    return this.toDto(created);
  }

  /**
   * One vote per employee, idempotent + race-safe. Rather than check-then-insert
   * (which lets a concurrent double-tap pass the check twice, then 500 on the
   * second insert), we insert unconditionally and let the
   * `@@unique([suggestionId, employeeId])` constraint reject duplicates: a
   * P2002 means "already voted" and is treated as a no-op returning current state.
   */
  async vote(employeeId: string, id: string): Promise<SuggestionDto> {
    const exists = await this.prisma.suggestion.findUnique({ where: { id } });
    if (!exists) {
      throw new NotFoundException('Suggestion not found');
    }

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        await tx.suggestionVote.create({ data: { suggestionId: id, employeeId } });
        return tx.suggestion.update({
          where: { id },
          data: { votes: { increment: 1 } },
        });
      });
      return this.toDto(updated);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return this.toDto(exists);
      }
      throw error;
    }
  }
}

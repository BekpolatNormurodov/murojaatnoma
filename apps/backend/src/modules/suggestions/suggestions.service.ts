import { Injectable, NotFoundException } from '@nestjs/common';
import { Suggestion } from '@prisma/client';
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

  /** One vote per employee (idempotent): first vote increments, repeats no-op. */
  async vote(employeeId: string, id: string): Promise<SuggestionDto> {
    const exists = await this.prisma.suggestion.findUnique({ where: { id } });
    if (!exists) {
      throw new NotFoundException('Suggestion not found');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const already = await tx.suggestionVote.findUnique({
        where: { suggestionId_employeeId: { suggestionId: id, employeeId } },
      });
      if (already) {
        return tx.suggestion.findUniqueOrThrow({ where: { id } });
      }
      await tx.suggestionVote.create({ data: { suggestionId: id, employeeId } });
      return tx.suggestion.update({
        where: { id },
        data: { votes: { increment: 1 } },
      });
    });
    return this.toDto(updated);
  }
}

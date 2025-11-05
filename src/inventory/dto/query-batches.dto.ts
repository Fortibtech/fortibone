// src/inventory/dto/query-batches.dto.ts
import { QueryPaginationDto } from 'src/common/dto/query-pagination.dto';
// Ce DTO peut être étendu avec des filtres (ex: par date de péremption)
export class QueryBatchesDto extends QueryPaginationDto {}

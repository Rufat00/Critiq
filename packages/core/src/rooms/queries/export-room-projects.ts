import { requireHackathonId } from '../../context';
import { createQuery } from '../../shared/operations';
import { listRoomsSchema } from '../schemas/list-rooms-schema';
import { roomSearchWhere } from '../lib/room-search-where';

function csvCell(value: string | number | null) {
  let text = String(value ?? '');
  // Keep spreadsheet applications from interpreting user content as formulas.
  if (/^[\s\uFEFF]*[=+@-]|^[\t\r\n]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export const exportRoomProjects = createQuery({
  name: 'rooms.export-projects',
  schema: listRoomsSchema.pick({ search: true }),
  roles: ['OWNER', 'ADMIN'],
})(async ({ ctx, input }) => {
  const hackathonId = requireHackathonId(ctx);
  const room = { is: roomSearchWhere(hackathonId, input.search) };
  const projects = await ctx.db.project.findMany({
    where: {
      hackathonId,
      ...(input.search ? { room } : { OR: [{ roomId: null }, { room }] }),
    },
    orderBy: [
      { room: { name: 'asc' } },
      { tableNumber: { sort: 'asc', nulls: 'last' } },
      { name: 'asc' },
      { id: 'asc' },
    ],
    select: {
      name: true,
      tableNumber: true,
      room: { select: { name: true, description: true } },
    },
  });
  const rows = [
    ['Project name', 'Table number', 'Room name', 'Room description'],
    ...projects.map((project) => [
      project.name,
      project.tableNumber,
      project.room?.name ?? 'Unassigned',
      project.room?.description ?? '',
    ]),
  ];
  return {
    csv:
      '\uFEFF' +
      rows.map((row) => row.map(csvCell).join(',')).join('\r\n') +
      '\r\n',
    projectCount: projects.length,
  };
});

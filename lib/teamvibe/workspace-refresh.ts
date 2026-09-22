import type { Project, User } from "./types";

export type WorkspaceSnapshot = {
  user: User | null;
  users: User[];
  projects: Project[];
};

// Requests can complete out of order. A write invalidates reads started both
// before and during the write, including failed writes and profile changes.
export function createRefreshGate() {
  let serial = 0;
  let generation = 0;
  let writes = 0;
  return {
    canRead: () => writes === 0,
    begin: () => ({ serial: ++serial, generation }),
    accepts: (ticket: { serial: number; generation: number }) =>
      writes === 0 &&
      ticket.serial === serial &&
      ticket.generation === generation,
    invalidate: () => {
      generation++;
    },
    beginWrite: () => {
      writes++;
      generation++;
      let finished = false;
      return () => {
        if (finished) return;
        finished = true;
        writes--;
        generation++;
      };
    },
  };
}

export function mergeWorkspaceSnapshot(
  current: WorkspaceSnapshot | null,
  incoming: WorkspaceSnapshot,
): WorkspaceSnapshot {
  if (!current?.user || current.user.id !== incoming.user?.id) return incoming;
  const existing = new Map(
    current.projects.map((project) => [project.id, project]),
  );
  return {
    ...incoming,
    // The server's membership list is authoritative. Never reinsert a project
    // omitted from the latest response merely because its old version is newer.
    projects: incoming.projects.map((project) => {
      const previous = existing.get(project.id);
      return previous && previous.version > project.version
        ? previous
        : project;
    }),
  };
}

export function commitWorkspaceProject(
  current: WorkspaceSnapshot | null,
  project: Project,
  actorId: string | undefined,
): WorkspaceSnapshot | null {
  if (!actorId || current?.user?.id !== actorId) return current;
  return {
    ...current,
    projects: current.projects.map((previous) =>
      previous.id === project.id && project.version >= previous.version
        ? project
        : previous,
    ),
  };
}

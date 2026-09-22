"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, Folder, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandItem,
} from "@/components/ui/command";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useSidebar } from "@/components/ui/sidebar";
import type { Project, User } from "@/lib/teamvibe/types";

export function ProjectPicker({
  projects,
  current,
  users,
  onSelect,
}: {
  projects: Project[];
  current: Project | null;
  users: User[];
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState("active");
  const [search, setSearch] = useState("");
  const { setOpenMobile } = useSidebar();
  const activeCount = projects.filter((p) => !p.deletedAt).length;
  const archivedCount = projects.length - activeCount;
  const visible = projects
    .filter((p) => (scope === "trash" ? !!p.deletedAt : !p.deletedAt))
    .sort(
      (a, b) =>
        Number(b.id === current?.id) - Number(a.id === current?.id) ||
        b.updatedAt.localeCompare(a.updatedAt),
    );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setSearch("");
          setScope(current?.deletedAt ? "trash" : "active");
        }
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <button
          className="workspace-picker project-picker-trigger"
          aria-label="프로젝트 선택"
        >
          <span className="workspace-icon" aria-hidden="true">
            T
          </span>
          <span className="project-picker-current">
            <strong>{current?.name || "프로젝트 선택"}</strong>
            <small>
              {current?.deletedAt ? "휴지통 · 복원 가능" : "프로젝트 찾기"}
            </small>
          </span>
          <ChevronsUpDown size={16} aria-hidden="true" />
        </button>
      </DialogTrigger>
      <DialogContent className="project-picker-dialog">
        <DialogHeader>
          <DialogTitle>프로젝트 선택</DialogTitle>
          <DialogDescription>
            참여 중인 프로젝트를 찾거나 휴지통에서 복원할 프로젝트를 여세요.
          </DialogDescription>
        </DialogHeader>
        <Tabs value={scope} onValueChange={setScope}>
          <TabsList aria-label="프로젝트 보관 상태">
            <TabsTrigger value="active">참여 중 {activeCount}</TabsTrigger>
            <TabsTrigger value="trash">휴지통 {archivedCount}</TabsTrigger>
          </TabsList>
          <TabsContent value={scope}>
            <Command
              className="project-picker-command"
              label="프로젝트 이름 또는 설명 검색"
            >
              <CommandInput
                value={search}
                onValueChange={setSearch}
                placeholder="이름 또는 설명으로 검색"
                aria-label="프로젝트 이름 또는 설명 검색"
              />
              <CommandList
                aria-label={
                  scope === "trash" ? "휴지통 프로젝트" : "참여 중인 프로젝트"
                }
              >
                <CommandEmpty>
                  {search.trim()
                    ? "일치하는 프로젝트가 없습니다. 검색어나 보관 상태를 바꿔 보세요."
                    : scope === "trash"
                      ? "휴지통에 보관한 프로젝트가 없습니다."
                      : "참여 중인 프로젝트가 없습니다. 프로젝트를 만들거나 초대 코드로 참여하세요."}
                </CommandEmpty>
                {visible.map((project) => {
                  const owner =
                    users.find((u) => u.id === project.ownerId)?.name ||
                    "이전 사용자";
                  return (
                    <CommandItem
                      key={project.id}
                      value={project.id}
                      keywords={[project.name, project.description]}
                      className="project-picker-option"
                      onSelect={() => {
                        onSelect(project.id);
                        setOpen(false);
                        setOpenMobile(false);
                      }}
                    >
                      {project.deletedAt ? (
                        <Trash2 aria-hidden="true" />
                      ) : (
                        <Folder aria-hidden="true" />
                      )}
                      <span className="project-picker-details">
                        <strong>{project.name}</strong>
                        {project.description && (
                          <span className="project-picker-description">
                            {project.description}
                          </span>
                        )}
                        <small>
                          오너 {owner} · 팀원 {project.members.length}명
                          {project.id === current?.id ? " · 현재 프로젝트" : ""}
                        </small>
                      </span>
                      {project.id === current?.id && (
                        <Check aria-hidden="true" />
                      )}
                    </CommandItem>
                  );
                })}
              </CommandList>
            </Command>
          </TabsContent>
        </Tabs>
        <p className="muted-text">
          {scope === "trash"
            ? "내용은 보존되어 있으며 프로젝트 오너가 복원할 수 있습니다."
            : "검색 전 목록은 현재 프로젝트, 최근 변경 순으로 표시합니다."}
        </p>
      </DialogContent>
    </Dialog>
  );
}

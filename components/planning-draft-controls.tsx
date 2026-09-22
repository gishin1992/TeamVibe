"use client";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

export function PlanningDraftControls({
  hasDraft,
  busy,
  onClear,
}: {
  hasDraft: boolean;
  busy: boolean;
  onClear: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="form-field">
      <p className="muted-text">
        요청과 응답은 이 페이지에서 사용자·프로젝트별로 유지됩니다. 다른 화면에
        다녀온 뒤에는 내용을 다시 검토하세요. 새로고침하면 사라집니다.
      </p>
      {hasDraft && (
        <button
          type="button"
          className="button secondary"
          disabled={busy}
          onClick={() => setConfirm(true)}
        >
          작성 중인 자료 지우기
        </button>
      )}
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>작성 중인 자료를 지울까요?</AlertDialogTitle>
            <AlertDialogDescription>
              이 창의 요청과 응답 JSON을 지웁니다. 프로젝트에 이미 등록한
              요구사항과 스토리는 유지됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>계속 검토</AlertDialogCancel>
            <AlertDialogAction onClick={onClear}>자료 지우기</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

const form = document.querySelector("#request-form");
const item = document.querySelector("#item");
const quantity = document.querySelector("#quantity");
const list = document.querySelector("#requests");
const status = document.querySelector("#status");
const save = document.querySelector("#save");
const cancelEdit = document.querySelector("#cancel-edit");
let entries = [];
let editing = null;
let sequence = 0;

function finishEditing() {
  editing = null;
  form.reset();
  save.textContent = "신청하기";
  cancelEdit.hidden = true;
}

function render() {
  list.replaceChildren();
  document.querySelector("#empty").hidden = entries.length > 0;
  for (const entry of entries) {
    const row = document.createElement("li");
    const text = document.createElement("span");
    text.textContent = `${entry.item} · ${entry.quantity}개 · 승인 대기`;
    const edit = document.createElement("button");
    edit.type = "button";
    edit.textContent = editing === entry.id ? "수정 중" : "수정";
    edit.disabled = editing !== null;
    edit.addEventListener("click", () => {
      editing = entry.id;
      item.value = entry.item;
      quantity.value = String(entry.quantity);
      save.textContent = "수정 저장";
      cancelEdit.hidden = false;
      status.textContent = "저장 전까지 원래 신청이 유지됩니다. 수정 취소로 돌아갈 수 있습니다.";
      render();
      item.focus();
    });
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "취소";
    remove.addEventListener("click", () => {
      entries = entries.filter((value) => value.id !== entry.id);
      if (editing === entry.id) finishEditing();
      render();
      status.textContent = "신청을 취소했습니다.";
    });
    row.append(text, edit, remove);
    list.append(row);
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = item.value.trim();
  const count = Number(quantity.value);
  if (!name) {
    status.textContent = "품목을 입력해 주세요. 기존 신청과 작성 중인 수량은 유지됩니다.";
    item.focus();
    return;
  }
  if (!Number.isSafeInteger(count) || count < 1) {
    status.textContent = "수량은 1 이상의 정수로 입력해 주세요. 기존 신청과 입력은 유지됩니다.";
    quantity.focus();
    return;
  }
  const wasEditing = editing !== null;
  if (wasEditing) {
    entries = entries.map((entry) => entry.id === editing ? { ...entry, item: name, quantity: count } : entry);
  } else {
    entries.unshift({ id: ++sequence, item: name, quantity: count });
  }
  finishEditing();
  render();
  status.textContent = wasEditing ? "신청을 수정했습니다." : "신청을 등록했습니다.";
});

cancelEdit.addEventListener("click", () => {
  finishEditing();
  render();
  status.textContent = "수정을 취소했습니다. 원래 신청은 그대로입니다.";
});
render();

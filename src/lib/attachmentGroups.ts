export interface AttachmentGroup {
  key: string;
  folder?: string;
  label: string;
  ids: string[];
  count: number;
}

export function groupAttachmentsByFolder(items: { id: string; name: string }[]): AttachmentGroup[] {
  const groups: AttachmentGroup[] = [];
  const byFolder = new Map<string, AttachmentGroup>();
  for (const item of items) {
    const slash = item.name.indexOf('/');
    if (slash === -1) {
      groups.push({ key: item.id, label: item.name, ids: [item.id], count: 1 });
      continue;
    }
    const folder = item.name.slice(0, slash);
    const existing = byFolder.get(folder);
    if (existing) {
      existing.ids.push(item.id);
      existing.count += 1;
    } else {
      const group: AttachmentGroup = { key: `dir:${folder}`, folder, label: folder, ids: [item.id], count: 1 };
      byFolder.set(folder, group);
      groups.push(group);
    }
  }
  return groups;
}

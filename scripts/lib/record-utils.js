export function titleFor(record, key) {
  return record?.name || record?.title || record?.fileName || record?.textureName || key;
}

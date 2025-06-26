export function getAllFiles(location: string) {
  const filesIterator = Deno.readDirSync(location);
  const files = Array.from(filesIterator).filter((file) => file.isFile).map((
    file,
  ) => file.name);
  return files;
}

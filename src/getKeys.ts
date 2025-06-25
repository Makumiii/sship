export function getKeys(files:string[]){
  const idKeys = files.filter((file) => {
    return (file.endsWith(".pub") || file.endsWith(".pem") ||
      file.endsWith(".pkcs8"));
  });
  const pairNames = idKeys.map((file) => {
    const fileNameParts = file.split(".");
    return fileNameParts[0];
  });
  return pairNames

}
export async function listNotes() {
  return window.api.listNotes()
}

export async function readNote(filePath: string) {
  return window.api.readNote(filePath)
}

export async function writeNote(filePath: string, content: string) {
  return window.api.writeNote(filePath, content)
}

export async function neurostarsPath() {
  return window.api.neurostarsPath()
}

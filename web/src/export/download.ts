/** 브라우저 다운로드를 시작한다. 파일은 사용자의 기기에만 저장되고 서버로 가지 않는다. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // 다운로드가 시작될 시간을 준 뒤 해제한다.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

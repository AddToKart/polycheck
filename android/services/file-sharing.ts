import * as FileSystem from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'

const safeFileName = (fileName: string) =>
  fileName.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')

const writeAndShare = async (
  contents: string,
  fileName: string,
  mimeType: string,
  encoding: FileSystem.EncodingType,
  dialogTitle: string,
) => {
  if (!FileSystem.cacheDirectory) throw new Error('Temporary file storage is unavailable on this device.')
  if (!(await Sharing.isAvailableAsync())) throw new Error('The system share sheet is unavailable on this device.')

  const uri = `${FileSystem.cacheDirectory}${safeFileName(fileName)}`
  await FileSystem.writeAsStringAsync(uri, contents, { encoding })
  await Sharing.shareAsync(uri, {
    mimeType,
    dialogTitle,
    UTI: mimeType === 'text/csv' ? 'public.comma-separated-values-text' : undefined,
  })
}

export const shareCsvFile = (
  csv: string,
  fileName: string,
  dialogTitle = 'Export attendance CSV',
) => writeAndShare(csv, fileName, 'text/csv', FileSystem.EncodingType.UTF8, dialogTitle)

export const sharePngFile = (
  base64: string,
  fileName: string,
  dialogTitle = 'Share QR code',
) => writeAndShare(base64, fileName, 'image/png', FileSystem.EncodingType.Base64, dialogTitle)

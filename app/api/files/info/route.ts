import { NextRequest, NextResponse } from 'next/server';
import { getFileRecordByShortId } from '@/app/lib/data/api-file-store';

function formatSqlTimestamp(ms: number): string {
  return new Date(ms).toISOString().slice(0, 19).replace('T', ' ');
}

// GET /api/files/info?file_code=a,b,c - DDownload-compatible file info lookup by shortId
export async function GET(request: NextRequest) {
  const fileCodeParam = request.nextUrl.searchParams.get('file_code');

  if (!fileCodeParam) {
    return NextResponse.json(
      { msg: 'Bad Request', status: 400, error: 'file_code parameter is required (comma-separated shortCodes)' },
      { status: 400 }
    );
  }

  const shortCodes = fileCodeParam.split(',').map((c) => c.trim()).filter(Boolean);

  const result = await Promise.all(
    shortCodes.map(async (filecode) => {
      const record = await getFileRecordByShortId(filecode);
      if (!record) {
        return { status: 404, filecode };
      }

      return {
        status: 200,
        filecode: record.shortId,
        name: record.name,
        size: String(record.size),
        uploaded: formatSqlTimestamp(record.createdAt),
        download: String(record.downloadCount),
        status_field: 'active',
      };
    })
  );

  return NextResponse.json({
    msg: 'OK',
    server_time: formatSqlTimestamp(Date.now()),
    status: 200,
    result,
  });
}

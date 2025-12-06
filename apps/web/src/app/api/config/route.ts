/**
 * Runtime configuration endpoint
 * Returns public environment variables that need to be dynamic
 */
export async function GET() {
  return Response.json({
    apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1',
  });
}

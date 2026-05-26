import { getToken } from '@auth/core/jwt';
import { resolveAuthParentOrigin } from '@/utils/authParentOrigin';

export async function GET(request) {
	const configuredOrigins = [
		process.env.AUTH_BRIDGE_PARENT_ORIGINS,
		process.env.CORS_ORIGINS,
	]
		.filter(Boolean)
		.flatMap((origins) => origins.split(',').map((origin) => origin.trim()))
		.filter(Boolean);
	const targetOrigin = resolveAuthParentOrigin(request.url, configuredOrigins);
	if (!targetOrigin) {
		return Response.json(
			{ error: 'Untrusted authentication parent origin' },
			{ status: 400, headers: { 'Cache-Control': 'no-store' } }
		);
	}

	const isSecure = process.env.AUTH_URL?.startsWith('https') ?? request.url?.startsWith('https') ?? false;
	const [token, jwt] = await Promise.all([
		getToken({
			req: request,
			secret: process.env.AUTH_SECRET,
			secureCookie: isSecure,
			raw: true,
		}),
		getToken({
			req: request,
			secret: process.env.AUTH_SECRET,
			secureCookie: isSecure,
		}),
	]);

	if (!jwt) {
		return new Response(
			`
			<html>
				<body>
					<script>
						window.parent.postMessage({ type: 'AUTH_ERROR', error: 'Unauthorized' }, ${JSON.stringify(targetOrigin)});
					</script>
				</body>
			</html>
			`,
			{
				status: 401,
				headers: {
					'Content-Type': 'text/html',
					'Cache-Control': 'no-store',
					'Content-Security-Policy': `default-src 'none'; script-src 'unsafe-inline'; frame-ancestors ${targetOrigin}`,
				},
			}
		);
	}

	const message = {
		type: 'AUTH_SUCCESS',
		jwt: token,
		user: {
			id: jwt.sub,
			email: jwt.email,
			name: jwt.name,
		},
	};

	return new Response(
		`
		<html>
			<body>
				<script>
					window.parent.postMessage(${JSON.stringify(message)}, ${JSON.stringify(targetOrigin)});
				</script>
			</body>
		</html>
		`,
		{
			headers: {
				'Content-Type': 'text/html',
				'Cache-Control': 'no-store',
				'Content-Security-Policy': `default-src 'none'; script-src 'unsafe-inline'; frame-ancestors ${targetOrigin}`,
			},
		}
	);
}

import { getToken } from '@auth/core/jwt';
import { getContext } from 'hono/context-storage';

export default function CreateAuth() {
	const auth = async () => {
		const c = getContext();
		const isSecure = process.env.AUTH_URL?.startsWith('https') ?? c.req.raw.url?.startsWith('https') ?? false;
		const token = await getToken({
			req: c.req.raw,
			secret: process.env.AUTH_SECRET,
			secureCookie: isSecure,
		});
		if (token) {
			return {
				user: {
					id: token.sub,
					email: token.email,
					name: token.name,
					image: token.picture,
				},
				expires: token.exp.toString(),
			};
		}
	};
	return {
		auth,
	};
}

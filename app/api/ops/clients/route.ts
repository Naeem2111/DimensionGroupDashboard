import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
	clampTierPercent,
	isOpsPricingTier,
	laneCostForTier,
	pricingTierForPercent,
} from "@/lib/ops-constants";
import { requireOpsSession } from "@/lib/ops-access";
import { parseImageUrlField } from "@/lib/image-url";
import { parseHexColor } from "@/lib/hex-color";
import { parseAvatarTextTone } from "@/lib/avatar-text-tone";
import {
	clientInclude,
	mapClientToJson,
	parseContactsFromBody,
} from "@/lib/ops-client-api";
import { resolveUniqueClientSlug, slugifyClientName } from "@/lib/client-slug";

export async function GET(request: NextRequest) {
	const gate = await requireOpsSession(request);
	if (gate instanceof NextResponse) return gate;

	const clients = await prisma.opsClient.findMany({
		orderBy: { name: "asc" },
		include: clientInclude,
	});

	return NextResponse.json({
		clients: clients.map(mapClientToJson),
	});
}

export async function POST(request: NextRequest) {
	const gate = await requireOpsSession(request);
	if (gate instanceof NextResponse) return gate;

	try {
		const body = await request.json();
		const name = String(body.name || "").trim();
		if (name.length < 1 || name.length > 200) {
			return NextResponse.json(
				{ error: "Client name required (1–200 characters)" },
				{ status: 400 },
			);
		}

		const tierPercent = clampTierPercent(body.tierPercent);
		const tierRaw = String(body.pricingTier || "");
		const pricingTier = isOpsPricingTier(tierRaw)
			? tierRaw
			: pricingTierForPercent(tierPercent);
		const laneCostGbp =
			body.laneCostGbp != null && Number(body.laneCostGbp) > 0
				? Number(body.laneCostGbp)
				: laneCostForTier(pricingTier);
		const activeLaneCount = Math.max(
			1,
			Math.min(20, Number(body.activeLaneCount) || 1),
		);
		const contacts = parseContactsFromBody(body) ?? [];

		let logoUrl: string | null | undefined;
		try {
			logoUrl = parseImageUrlField(body.logoUrl);
		} catch (e) {
			return NextResponse.json(
				{ error: e instanceof Error ? e.message : "Invalid logo URL" },
				{ status: 400 },
			);
		}

		let logoBgColor: string | null | undefined;
		if (body.logoBgColor !== undefined) {
			const parsed = parseHexColor(body.logoBgColor);
			if (body.logoBgColor !== null && body.logoBgColor !== "" && !parsed) {
				return NextResponse.json(
					{ error: "Invalid logo background colour" },
					{ status: 400 },
				);
			}
			logoBgColor = parsed;
		}

		let logoTextTone: string | null | undefined;
		if (body.logoTextTone !== undefined) {
			const parsed = parseAvatarTextTone(body.logoTextTone);
			if (
				body.logoTextTone !== null &&
				body.logoTextTone !== "" &&
				parsed === null
			) {
				return NextResponse.json(
					{ error: "Logo text colour must be light or dark" },
					{ status: 400 },
				);
			}
			logoTextTone = parsed;
		}

		const slug = await resolveUniqueClientSlug(name);

		const client = await prisma.opsClient.create({
			data: {
				name,
				slug,
				companyName: body.companyName ? String(body.companyName).trim() : null,
				software: body.software ? String(body.software).trim() : null,
				phone: body.phone ? String(body.phone).trim() : null,
				country: body.country ? String(body.country).trim() : null,
				notes: body.notes ? String(body.notes).trim() : null,
				...(logoUrl !== undefined ? { logoUrl } : {}),
				...(logoBgColor !== undefined ? { logoBgColor } : {}),
				...(logoTextTone !== undefined ? { logoTextTone } : {}),
				contacts: {
					create: contacts.map((c, i) => ({
						name: c.name,
						email: c.email,
						sortOrder: i,
					})),
				},
				commercial: {
					create: {
						pricingTier,
						tierPercent,
						laneCostGbp,
						activeLaneCount,
					},
				},
			},
			include: clientInclude,
		});

		return NextResponse.json(
			{ client: mapClientToJson(client) },
			{ status: 201 },
		);
	} catch {
		return NextResponse.json({ error: "Invalid request" }, { status: 400 });
	}
}

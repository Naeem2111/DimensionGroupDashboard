"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { AddPracticeForm } from "@/components/practices/AddPracticeForm";
import { EditPracticeModal } from "@/components/practices/EditPracticeModal";
import { getBestAddressFromFields } from "@/lib/address-display";
import { gmailComposeUrl } from "@/lib/gmail-compose";

interface Architect {
	url: string;
	name: string;
	website: string;
	socials: string[];
	email: string;
	address: string;
	contact: string;
	phone: string;
	description: string;
	years_active: string;
	staff: string;
	awards: string[];
}

const COLUMN_IDS = [
	"name",
	"email",
	"contact",
	"phone",
	"website",
	"address",
	"years_active",
	"staff",
	"description",
	"socials",
	"awards",
	"actions",
] as const;

type ColumnId = (typeof COLUMN_IDS)[number];

const COLUMN_LABELS: Record<ColumnId, string> = {
	name: "Name",
	email: "Email",
	contact: "Contact",
	phone: "Contact number",
	website: "Website",
	address: "Address",
	years_active: "Years active",
	staff: "Staff",
	description: "Description",
	socials: "Socials",
	awards: "Awards",
	actions: "Actions",
};

const STORAGE_KEY = "blocarch-practices-columns";

const DEFAULT_VISIBLE: Record<ColumnId, boolean> = {
	name: true,
	email: true,
	contact: true,
	phone: true,
	website: true,
	address: true,
	years_active: true,
	staff: true,
	description: false,
	socials: false,
	awards: false,
	actions: true,
};

function loadVisibility(): Record<ColumnId, boolean> {
	if (typeof window === "undefined") return { ...DEFAULT_VISIBLE };
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return { ...DEFAULT_VISIBLE };
		const parsed = JSON.parse(raw) as Partial<Record<ColumnId, boolean>>;
		return { ...DEFAULT_VISIBLE, ...parsed };
	} catch {
		return { ...DEFAULT_VISIBLE };
	}
}

function slugFromUrl(url: string): string {
	const m = url.match(/\/practice\/([^/]+)\/?$/);
	return m ? m[1] : url;
}

function truncate(s: string, max: number): string {
	const t = s.replace(/\s+/g, " ").trim();
	if (t.length <= max) return t;
	return t.slice(0, max - 1) + "…";
}

export function PracticesClient() {
	const [q, setQ] = useState("");
	const [query, setQuery] = useState("");
	const [page, setPage] = useState(1);
	const [data, setData] = useState<{
		items: Architect[];
		total: number;
		page: number;
		totalPages: number;
	} | null>(null);
	const [loading, setLoading] = useState(true);
	const [refreshKey, setRefreshKey] = useState(0);
	const [editing, setEditing] = useState<Architect | null>(null);
	const [columnsOpen, setColumnsOpen] = useState(false);
	const [visible, setVisible] =
		useState<Record<ColumnId, boolean>>(DEFAULT_VISIBLE);
	const skipSaveRef = useRef(true);

	useEffect(() => {
		setVisible(loadVisibility());
	}, []);

	useEffect(() => {
		if (typeof window === "undefined") return;
		if (skipSaveRef.current) {
			skipSaveRef.current = false;
			return;
		}
		localStorage.setItem(STORAGE_KEY, JSON.stringify(visible));
	}, [visible]);

	useEffect(() => {
		setLoading(true);
		const params = new URLSearchParams();
		if (query) params.set("q", query);
		params.set("page", String(page));
		params.set("perPage", "25");
		fetch(`/api/practices?${params}`)
			.then((r) => r.json())
			.then(setData)
			.finally(() => setLoading(false));
	}, [query, page, refreshKey]);

	const toggleColumn = (id: ColumnId) => {
		setVisible((v) => ({ ...v, [id]: !v[id] }));
	};

	const showAllColumns = () => {
		setVisible(
			COLUMN_IDS.reduce(
				(acc, id) => {
					acc[id] = true;
					return acc;
				},
				{} as Record<ColumnId, boolean>,
			),
		);
	};

	const resetColumns = () => {
		setVisible({ ...DEFAULT_VISIBLE });
	};

	const activeColumns = useMemo(
		() => COLUMN_IDS.filter((id) => visible[id]),
		[visible],
	);

	return (
		<div>
			{editing ? (
				<EditPracticeModal
					practice={editing}
					onClose={() => setEditing(null)}
					onSaved={(updated) => {
						setData((current) =>
							current
								? {
										...current,
										items: current.items.map((item) =>
											item.url === updated.url ? { ...item, ...updated } : item,
										),
									}
								: current,
						);
					}}
				/>
			) : null}
			<div className="mb-6">
				<AddPracticeForm
					onCreated={() => {
						setPage(1);
						setRefreshKey((k) => k + 1);
					}}
				/>
			</div>
			<div className="flex flex-col gap-3 mb-6 sm:flex-row sm:items-start sm:gap-3">
				<input
					type="search"
					value={q}
					onChange={(e) => setQ(e.target.value)}
					onKeyDown={(e) => e.key === "Enter" && setQuery(q)}
					placeholder="Search by name, email, address..."
					className="flex-1 rounded-lg border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-white placeholder-slate-500 ring-1 ring-black/20 focus:border-brand-500/50 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
				/>
				<div className="flex flex-wrap gap-2">
					<button
						type="button"
						onClick={() => {
							setQuery(q);
							setPage(1);
						}}
						className="rounded-lg bg-gradient-to-r from-brand-500 to-brand-600 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-brand/25 transition-opacity hover:opacity-95"
					>
						Search
					</button>
					<div className="relative">
						<button
							type="button"
							onClick={() => setColumnsOpen((o) => !o)}
							className="rounded-lg border border-white/[0.08] bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-slate-200 ring-1 ring-white/[0.04] transition-colors hover:bg-white/[0.09]"
							aria-expanded={columnsOpen}
							aria-controls="practices-column-panel"
						>
							Columns
						</button>
						{columnsOpen && (
							<>
								<button
									type="button"
									className="fixed inset-0 z-10 cursor-default"
									aria-label="Close column menu"
									onClick={() => setColumnsOpen(false)}
								/>
								<div
									id="practices-column-panel"
									className="absolute right-0 z-20 mt-1 w-[min(100vw-2rem,20rem)] rounded-lg border border-slate-600 bg-slate-900 p-3 shadow-xl"
								>
									<p className="text-xs text-slate-500 mb-2">
										Show or hide table columns
									</p>
									<ul className="space-y-1.5 max-h-[min(60vh,20rem)] overflow-y-auto">
										{COLUMN_IDS.map((id) => (
											<li key={id}>
												<label className="flex items-center gap-2 cursor-pointer text-sm text-slate-300 hover:text-white">
													<input
														type="checkbox"
														checked={visible[id]}
														onChange={() => toggleColumn(id)}
														className="rounded border-white/20 bg-white/[0.03] text-brand-400 focus:ring-brand-500/50"
													/>
													{COLUMN_LABELS[id]}
												</label>
											</li>
										))}
									</ul>
									<div className="mt-3 flex gap-2 border-t border-slate-700 pt-3">
										<button
											type="button"
											onClick={showAllColumns}
											className="flex-1 text-xs py-1.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700"
										>
											Show all
										</button>
										<button
											type="button"
											onClick={resetColumns}
											className="flex-1 text-xs py-1.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700"
										>
											Defaults
										</button>
									</div>
								</div>
							</>
						)}
					</div>
				</div>
			</div>

			{loading && <p className="text-slate-400 py-8">Loading...</p>}
			{!loading && data && (
				<>
					<p className="text-slate-500 text-sm mb-4">
						{data.total} practice{data.total !== 1 ? "s" : ""} found
					</p>
					<div className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-white/[0.02] ring-1 ring-white/[0.04]">
						<table className="w-full min-w-[720px]">
							<thead>
								<tr className="bg-white/[0.04] text-left text-sm text-slate-400">
									{activeColumns.map((col) => (
										<th
											key={col}
											className="px-4 py-3 font-medium whitespace-nowrap"
										>
											{COLUMN_LABELS[col]}
										</th>
									))}
								</tr>
							</thead>
							<tbody className="divide-y divide-white/[0.06]">
								{data.items.map((p) => {
									const addr = getBestAddressFromFields(
										p.address,
										p.description,
									);
									const socials = Array.isArray(p.socials) ? p.socials : [];
									const awards = Array.isArray(p.awards) ? p.awards : [];
									return (
										<tr
											key={p.url}
											className="transition-colors hover:bg-white/[0.03]"
										>
											{visible.name && (
												<td className="px-4 py-3">
													<span className="font-medium text-white">
														{p.name || "—"}
													</span>
												</td>
											)}
											{visible.email && (
												<td className="px-4 py-3 text-slate-300 text-sm max-w-[18rem]">
													{p.email ? (
														<div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
															<span className="break-all text-slate-300">
																{p.email}
															</span>
															<a
																href={gmailComposeUrl(p.email)}
																target="_blank"
																rel="noopener noreferrer"
																className="inline-flex w-fit shrink-0 items-center justify-center rounded-lg border border-white/[0.1] bg-white/[0.07] px-3 py-1.5 text-xs font-semibold text-slate-100 ring-1 ring-white/[0.06] transition-colors hover:bg-white/[0.11]"
															>
																Gmail
															</a>
														</div>
													) : (
														"—"
													)}
												</td>
											)}
											{visible.contact && (
												<td className="px-4 py-3 text-slate-300 text-sm max-w-[12rem]">
													{p.contact || "—"}
												</td>
											)}
											{visible.phone && (
												<td className="px-4 py-3 text-slate-300 text-sm max-w-[12rem] whitespace-nowrap">
													{p.phone || "—"}
												</td>
											)}
											{visible.website && (
												<td className="px-4 py-3 text-slate-300 text-sm max-w-[12rem]">
													{p.website ? (
														<a
															href={
																p.website.startsWith("http")
																	? p.website
																	: `https://${p.website}`
															}
															target="_blank"
															rel="noopener noreferrer"
															className="text-brand-400 hover:text-brand-300 hover:underline break-all"
														>
															{truncate(
																p.website.replace(/^https?:\/\//, ""),
																48,
															)}
														</a>
													) : (
														"—"
													)}
												</td>
											)}
											{visible.address && (
												<td
													className="px-4 py-3 text-slate-400 text-sm max-w-[18rem]"
													title={addr || undefined}
												>
													{addr ? truncate(addr, 100) : "—"}
												</td>
											)}
											{visible.years_active && (
												<td className="px-4 py-3 text-slate-400 text-sm whitespace-nowrap">
													{p.years_active || "—"}
												</td>
											)}
											{visible.staff && (
												<td className="px-4 py-3 text-slate-400 text-sm">
													{p.staff || "—"}
												</td>
											)}
											{visible.description && (
												<td
													className="px-4 py-3 text-slate-400 text-sm max-w-[24rem]"
													title={
														p.description
															? p.description.replace(/\s+/g, " ").trim()
															: undefined
													}
												>
													{p.description
														? truncate(p.description.replace(/\s+/g, " "), 160)
														: "—"}
												</td>
											)}
											{visible.socials && (
												<td className="px-4 py-3 text-slate-400 text-sm max-w-[16rem]">
													{socials.length === 0 ? (
														"—"
													) : (
														<div className="flex flex-col gap-0.5">
															{socials.slice(0, 3).map((s, i) => (
																<a
																	key={i}
																	href={
																		s.startsWith("http") ? s : `https://${s}`
																	}
																	target="_blank"
																	rel="noopener noreferrer"
																	className="truncate block text-brand-400/90 hover:text-brand-300 hover:underline"
																>
																	{truncate(s.replace(/^https?:\/\//, ""), 40)}
																</a>
															))}
															{socials.length > 3 && (
																<span className="text-slate-500 text-xs">
																	+{socials.length - 3} more
																</span>
															)}
														</div>
													)}
												</td>
											)}
											{visible.awards && (
												<td className="px-4 py-3 text-slate-400 text-sm max-w-[14rem]">
													{awards.length === 0 ? (
														"—"
													) : (
														<span title={awards.join(" · ")}>
															{awards.length === 1
																? truncate(awards[0], 100)
																: awards.length === 2
																	? truncate(`${awards[0]} · ${awards[1]}`, 100)
																	: `${awards.length} awards`}
														</span>
													)}
												</td>
											)}
											{visible.actions && (
												<td className="px-4 py-3 whitespace-nowrap">
													<div className="flex items-center gap-3">
														<button
															type="button"
															onClick={() => setEditing(p)}
															className="text-sm font-medium text-slate-300 hover:text-white"
														>
															Edit
														</button>
														<Link
															href={`/dashboard/practices/${encodeURIComponent(slugFromUrl(p.url))}`}
															className="text-sm font-medium text-brand-400 hover:text-brand-300"
														>
															View
														</Link>
													</div>
												</td>
											)}
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
					{data.totalPages > 1 && (
						<div className="flex items-center gap-2 mt-4">
							<button
								type="button"
								onClick={() => setPage((p) => Math.max(1, p - 1))}
								disabled={page <= 1}
								className="rounded border border-white/[0.08] bg-white/[0.06] px-3 py-1.5 text-sm text-slate-300 ring-1 ring-white/[0.04] transition-colors hover:bg-white/[0.09] disabled:cursor-not-allowed disabled:opacity-50"
							>
								Previous
							</button>
							<span className="text-slate-400 text-sm">
								Page {page} of {data.totalPages}
							</span>
							<button
								type="button"
								onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
								disabled={page >= data.totalPages}
								className="rounded border border-white/[0.08] bg-white/[0.06] px-3 py-1.5 text-sm text-slate-300 ring-1 ring-white/[0.04] transition-colors hover:bg-white/[0.09] disabled:cursor-not-allowed disabled:opacity-50"
							>
								Next
							</button>
						</div>
					)}
				</>
			)}
		</div>
	);
}

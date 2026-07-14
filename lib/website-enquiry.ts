import { randomUUID } from "crypto";
import { createOutreachLog } from "@/lib/lead-outreach";
import { getLead, updateLead } from "@/lib/leads";
import { prisma } from "@/lib/prisma";
import { DIMENSION_GROUP_SITE } from "@/lib/blocharch-brand";
import { isValidEmail } from "@/lib/practice-url";

export type QuoteEnquiryInput = {
  type: "quote";
  service: string;
  company: string;
  projectLocation: string;
  projectType: string;
  budget: string;
  message: string;
  region: string;
  name: string;
  email: string;
  phone?: string;
};

export type SimpleEnquiryInput = {
  type: "simple";
  name: string;
  email: string;
  message: string;
};

export type WebsiteEnquiryInput = QuoteEnquiryInput | SimpleEnquiryInput;

function websiteEnquiryUrl(id: string): string {
  return `website://dimensiongroupglobal/enquiry/${id}`;
}

function buildNotes(input: WebsiteEnquiryInput): string {
  if (input.type === "simple") {
    return `Website quick message\n\n${input.message}`;
  }
  return [
    "Website business enquiry",
    `Service: ${input.service}`,
    `Company: ${input.company}`,
    `Project location: ${input.projectLocation}`,
    `Project type: ${input.projectType}`,
    `Budget: ${input.budget}`,
    `Contact region: ${input.region}`,
    input.phone ? `Phone: ${input.phone}` : null,
    "",
    input.message,
  ]
    .filter(Boolean)
    .join("\n");
}

function displayName(input: WebsiteEnquiryInput): string {
  if (input.type === "quote") {
    return input.company.trim() || input.name.trim();
  }
  return input.name.trim();
}

export async function ingestWebsiteEnquiry(input: WebsiteEnquiryInput) {
  const email = input.email.trim().toLowerCase();
  const name = displayName(input);
  if (!name) throw new Error("Name or company is required");
  if (!email || !isValidEmail(email)) throw new Error("Valid email is required");

  const notes = buildNotes(input);
  const contactPerson = input.type === "quote" ? input.name.trim() : input.name.trim();
  const address =
    input.type === "quote"
      ? [input.projectLocation, input.region].filter(Boolean).join(" | ")
      : undefined;
  const phone = input.type === "quote" ? input.phone?.trim() : undefined;

  let architect = await prisma.architect.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
  });

  const isReturning = Boolean(architect);
  if (!architect) {
    const id = randomUUID();
    architect = await prisma.architect.create({
      data: {
        url: websiteEnquiryUrl(id),
        name,
        email,
        contact: contactPerson || null,
        phone: phone || null,
        address: address || null,
        website: DIMENSION_GROUP_SITE,
        description: input.type === "quote" ? `Service interest: ${input.service}` : "Website contact",
        socials: [],
        awards: [],
      },
    });
  } else {
    architect = await prisma.architect.update({
      where: { id: architect.id },
      data: {
        name: architect.name || name,
        contact: contactPerson || architect.contact,
        phone: phone || architect.phone,
        address: address || architect.address,
      },
    });
  }

  const existingLead = await getLead(architect.url);
  const mergedNotes = existingLead?.notes?.trim()
    ? `${existingLead.notes.trim()}\n\n---\n${notes}`
    : notes;

  await updateLead(architect.url, {
    stage: "interested",
    rating: 3,
    notes: mergedNotes,
    nextAction: "Respond to website enquiry",
    lastCommunicationType: "inbound_reply",
  });

  await createOutreachLog(architect.url, {
    stageAtLog: "interested",
    communicationType: input.type === "quote" ? "note" : "inbound_reply",
    direction: "inbound",
    contactPerson: contactPerson || undefined,
    emailAddress: email,
    subject:
      input.type === "quote"
        ? `Website enquiry - ${input.service}`
        : "Website contact message",
    messageBody: notes,
    internalNotes: isReturning
      ? "Repeat enquiry from dimensiongroupglobal.com contact form"
      : "Captured from dimensiongroupglobal.com contact form",
    contactDate: new Date().toISOString(),
    nextAction: "Review and respond",
  });

  return { id: architect.id, url: architect.url, name: architect.name, email: architect.email };
}

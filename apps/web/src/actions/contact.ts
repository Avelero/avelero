"use server";

import React from "react";
import { contactFormRateLimit } from "../lib/ratelimit";
import { getResend } from "../lib/resend";
import { render } from "@v1/email/render";
import ContactConfirmation from "@v1/email/emails/contact-confirmation";
import ContactNotification from "@v1/email/emails/contact-notification";
import { getLeadsTable } from "../lib/airtable";
import { headers } from "next/headers";
import validator from 'validator';
import * as CompanyEmailValidator from 'company-email-validator';

interface ContactFormData {
  email: string;
  name: string;
  company: string;
}

export async function submitContactForm(data: ContactFormData) {
  try {
    // 1. Rate limiting (3 submissions per IP per hour)
    const headersList = await headers();
    const forwarded = headersList.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(",")[0].trim() : "unknown";
    
    const { success, remaining } = await contactFormRateLimit.limit(`contact-form:${ip}`);
    
    if (!success) {
      return {
        success: false,
        error: "Too many requests. Please try again later.",
      };
    }

    // Check 1: Valid email format
    if (!validator.isEmail(data.email)) {
        return { success: false, error: "Please enter a valid email" };
    }

    // Check work email
    if (!CompanyEmailValidator.isCompanyEmail(data.email)) {
        return { success: false, error: "Please enter a work email" };
    }

    if (!data.name.trim() || !data.company.trim()) {
      return { success: false, error: "All fields are required" };
    }

    // 3. Store in Airtable
    const leadsTable = getLeadsTable();
    await leadsTable.create([
      {
        fields: {
          Email: data.email,
          Name: data.name,
          Company: data.company,
        },
      },
    ]);

    // 4. Send confirmation email to user
    const resend = getResend();
    const confirmationHtml = await render(
      React.createElement(ContactConfirmation, {
        name: data.name,
        email: data.email,
      })
    );

    await resend.emails.send({
      from: "Raf <raf@welcome.avelero.com>",
      to: [data.email],
      subject: `${data.name}, thanks for reaching out!`,
      html: confirmationHtml,
    });

    // 5. Send notification email to you
    const notificationHtml = await render(
      React.createElement(ContactNotification, {
        name: data.name,
        email: data.email,
        company: data.company,
        submittedAt: new Date().toLocaleString(),
      })
    );

    await resend.emails.send({
      from: "Avelero Website <notifications@welcome.avelero.com>",
      to: ["raf@avelero.com"],
      subject: `New contact: ${data.name} from ${data.company}`,
      html: notificationHtml,
    });

    return { success: true };
  } catch (error) {
    console.error("Contact form error:", error);
    return {
      success: false,
      error: "Something went wrong. Please try again.",
    };
  }
}

import {
  Body,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Text,
} from "@react-email/components";
import React from "react";

interface ContactConfirmationProps {
  name: string;
  email: string;
}

export default function ContactConfirmation({
  name,
  email,
}: ContactConfirmationProps) {
  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: 'Arial, sans-serif', fontSize: '14px', lineHeight: '1.5', color: '#000000' }}>
        <div style={{ maxWidth: '600px' }}>
          <p>hey {name}, just wanted to say thanks for reaching out!</p>
          
          <p>i received your message and will get back to you shortly.</p>
          <br />
          <br />
          <br />
          <br />
          {/* Signature */}
          <table cellPadding="0" cellSpacing="0" border={0}>
            <tr>
              <td style={{ paddingRight: '20px', verticalAlign: 'top' }}>
                <Img
                  src="https://res.cloudinary.com/dcdam15xy/image/upload/rafmevis_x0lltj.webp"
                  alt="Profile"
                  width="80"
                  height="80"
                />

                <Hr style={{ borderTop: '1px solid #e0e0e0', margin: '15px 0 20px 0' }} />

                <p style={{ margin: '0 0 4px 0', fontSize: '14px' }}>
                  <Link href="https://www.linkedin.com/in/rafaelmevis/" style={{ color: '#000000', textDecoration: 'underline' }}>LinkedIn</Link>
                </p>
                <p style={{ margin: '0 0 4px 0', fontSize: '14px' }}>
                  <Link href="https://x.com/rafmevis/" style={{ color: '#000000', textDecoration: 'underline' }}>X (twitter)</Link>
                </p>
              </td>
              <td style={{ verticalAlign: 'top' }}>
                <p style={{ margin: '4px 0 4px 0', fontSize: '14px' }}>
                  Raf Mevis
                </p>
                <p style={{ margin: '0 0 4px 0', fontSize: '14px' }}>
                  Co-Founder
                </p>
                <p style={{ margin: '0 0 12px 0', fontSize: '14px' }}>
                  Avelero
                </p>

                <Hr style={{ borderTop: '1px solid #e0e0e0', margin: '20px 0' }} />
                
                <p style={{ margin: '0 0 4px 0', fontSize: '14px' }}>
                  <Link href="tel:+31615297990" style={{ color: '#000000', textDecoration: 'underline' }}>+31615297990</Link>
                </p>
                <p style={{ margin: '0 0 4px 0', fontSize: '14px' }}>
                  <Link href="mailto:raf@avelero.com" style={{ color: '#000000', textDecoration: 'underline' }}>raf@avelero.com</Link>
                </p>
                <p style={{ margin: '0 0 4px 0', fontSize: '14px' }}>
                  <Link href="https://avelero.com" style={{ color: '#000000', textDecoration: 'underline' }}>https://avelero.com</Link>
                </p>
              </td>
            </tr>
          </table>
        </div>
      </Body>
    </Html>
  );
}

export const previewProps: ContactConfirmationProps = {
  name: "John Doe",
  email: "john@example.com",
};

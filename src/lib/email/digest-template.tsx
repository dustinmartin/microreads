import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Button,
  Hr,
  Img,
  Link,
  Preview,
  Font,
} from "@react-email/components";

interface BookSection {
  id: string;
  title: string;
  author: string;
  coverUrl: string | null;
  chapterTitle: string;
  progress: number;
  teaserParagraphs: string[];
  readUrl: string;
}

export interface DigestEmailProps {
  date: string;
  books: BookSection[];
  streak: number;
  totalReadingMinutes: number;
  libraryUrl: string;
}

export function DigestEmail({
  date,
  books,
  streak,
  totalReadingMinutes,
  libraryUrl,
}: DigestEmailProps) {
  const previewText = `Your morning reading — ${books.length} book${books.length !== 1 ? "s" : ""}, ~${totalReadingMinutes} min`;

  return (
    <Html lang="en">
      <Head>
        <Font
          fontFamily="Georgia"
          fallbackFontFamily="serif"
        />
      </Head>
      <Preview>{previewText}</Preview>
      <Body style={body}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Text style={headerTitle}>
              MICRO READS &middot; {date}
            </Text>
            <Text style={headerSubtitle}>Your morning reading</Text>
          </Section>

          <Hr style={divider} />

          {/* Book Sections */}
          {books.map((book, index) => (
            <Section key={book.id} style={bookSection}>
              {/* Book cover and metadata */}
              <table cellPadding="0" cellSpacing="0" style={{ width: "100%" }}>
                <tbody>
                  <tr>
                    {book.coverUrl && (
                      <td style={coverCell}>
                        <Img
                          src={book.coverUrl}
                          alt={`Cover of ${book.title}`}
                          width={60}
                          height={90}
                          style={coverImage}
                        />
                      </td>
                    )}
                    <td style={bookMetaCell}>
                      <Text style={bookTitle}>{book.title}</Text>
                      <Text style={bookAuthor}>by {book.author}</Text>
                      <Text style={chapterInfo}>
                        {book.chapterTitle} &middot; {book.progress}% complete
                      </Text>
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Teaser */}
              {book.teaserParagraphs.map((paragraph, paragraphIdx) => (
                <Text
                  key={`${book.id}-teaser-${paragraphIdx}`}
                  style={
                    paragraphIdx === book.teaserParagraphs.length - 1
                      ? teaserTextLast
                      : teaserText
                  }
                >
                  {paragraph}
                </Text>
              ))}

              {/* CTA Button */}
              <Button style={ctaButton} href={book.readUrl}>
                Continue Reading
              </Button>

              {index < books.length - 1 && <Hr style={bookDivider} />}
            </Section>
          ))}

          <Hr style={divider} />

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerStats}>
              Today: {books.length} book{books.length !== 1 ? "s" : ""} &middot; ~{totalReadingMinutes} min reading
            </Text>
            {streak > 0 && (
              <Text style={streakText}>
                {streak} day streak {streak >= 7 ? "-- keep it going!" : ""}
              </Text>
            )}
            <table cellPadding="0" cellSpacing="0" style={{ width: "100%", textAlign: "center" as const }}>
              <tbody>
                <tr>
                  <td>
                    <Link href={libraryUrl} style={footerLink}>
                      Open Library
                    </Link>
                    <Text style={footerLinkSeparator}>&nbsp;&middot;&nbsp;</Text>
                    <Link href={`${libraryUrl}#send-more`} style={footerLink}>
                      Send More
                    </Link>
                  </td>
                </tr>
              </tbody>
            </table>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export default DigestEmail;

/* ---------- Styles ---------- */

const body: React.CSSProperties = {
  backgroundColor: "#F5F3EF",
  fontFamily: "Georgia, 'Times New Roman', serif",
  margin: 0,
  padding: 0,
};

const container: React.CSSProperties = {
  maxWidth: "560px",
  margin: "0 auto",
  padding: "32px 24px",
  backgroundColor: "#FFFFFF",
  borderRadius: "8px",
  marginTop: "24px",
  marginBottom: "24px",
};

const header: React.CSSProperties = {
  textAlign: "center",
  paddingBottom: "8px",
};

const headerTitle: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: 600,
  letterSpacing: "2px",
  color: "#6B5E4F",
  textTransform: "uppercase",
  margin: "0 0 4px 0",
};

const headerSubtitle: React.CSSProperties = {
  fontSize: "20px",
  fontWeight: 400,
  color: "#2D2A26",
  margin: "0",
};

const divider: React.CSSProperties = {
  borderTop: "1px solid #E8E4DC",
  margin: "20px 0",
};

const bookSection: React.CSSProperties = {
  padding: "8px 0",
};

const coverCell: React.CSSProperties = {
  width: "72px",
  verticalAlign: "top",
  paddingRight: "16px",
};

const coverImage: React.CSSProperties = {
  borderRadius: "4px",
  objectFit: "cover" as const,
  border: "1px solid #E8E4DC",
};

const bookMetaCell: React.CSSProperties = {
  verticalAlign: "top",
};

const bookTitle: React.CSSProperties = {
  fontSize: "17px",
  fontWeight: 700,
  color: "#2D2A26",
  margin: "0 0 2px 0",
  lineHeight: "1.3",
};

const bookAuthor: React.CSSProperties = {
  fontSize: "14px",
  color: "#6B5E4F",
  margin: "0 0 4px 0",
};

const chapterInfo: React.CSSProperties = {
  fontSize: "12px",
  color: "#9A8E7F",
  margin: "0",
};

const teaserText: React.CSSProperties = {
  fontSize: "15px",
  lineHeight: "1.65",
  color: "#3D3832",
  margin: "14px 0 0 0",
};

const teaserTextLast: React.CSSProperties = {
  ...teaserText,
  margin: "14px 0 16px 0",
};

const ctaButton: React.CSSProperties = {
  backgroundColor: "#5B4A3F",
  color: "#FFFFFF",
  fontSize: "14px",
  fontWeight: 600,
  padding: "10px 24px",
  borderRadius: "6px",
  textDecoration: "none",
  display: "inline-block",
};

const bookDivider: React.CSSProperties = {
  borderTop: "1px solid #F0ECE6",
  margin: "24px 0",
};

const footer: React.CSSProperties = {
  textAlign: "center",
  paddingTop: "4px",
};

const footerStats: React.CSSProperties = {
  fontSize: "14px",
  color: "#6B5E4F",
  margin: "0 0 4px 0",
};

const streakText: React.CSSProperties = {
  fontSize: "14px",
  color: "#A0845C",
  fontWeight: 600,
  margin: "0 0 16px 0",
};

const footerLink: React.CSSProperties = {
  fontSize: "13px",
  color: "#5B4A3F",
  textDecoration: "underline",
};

const footerLinkSeparator: React.CSSProperties = {
  fontSize: "13px",
  color: "#9A8E7F",
  display: "inline",
  margin: "0",
};

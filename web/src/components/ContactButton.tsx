import { useState, useRef, useEffect } from 'react';

interface ContactButtonProps {
  listing: {
    year: number;
    make: string;
    model: string;
    asking_price: number;
    seller_phone: string | null;
    seller_name: string | null;
    source_url: string | null;
  };
}

export function ContactButton({ listing }: ContactButtonProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const message = `Hi, I'm interested in your ${listing.year} ${listing.make} ${listing.model} listed at $${listing.asking_price.toLocaleString('en-US')}. Is it still available? A few questions: 1) What is the VIN? 2) Are there any mechanical issues? 3) Has it been in any accidents? 4) Is the price negotiable? Thank you!`;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = message;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="px-4 py-2 rounded text-sm font-semibold cursor-pointer border-none transition-colors"
        style={{
          background: 'var(--gold)',
          color: '#0a0a0c',
        }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.background = 'var(--gold-dim)')
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.background = 'var(--gold)')
        }
      >
        Contact Seller
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-80 rounded border p-4 z-50 space-y-3"
          style={{
            background: 'var(--bg-elevated)',
            borderColor: 'var(--border)',
          }}
        >
          {/* Pre-written message */}
          <div>
            <div
              className="text-xs uppercase tracking-wider mb-1.5"
              style={{ color: 'var(--text-muted)' }}
            >
              Message
            </div>
            <div
              className="text-sm leading-relaxed p-3 rounded"
              style={{
                color: 'var(--text-secondary)',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
              }}
            >
              {message}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleCopy}
              className="px-3 py-1.5 rounded text-xs font-medium cursor-pointer border-none transition-colors"
              style={{
                background: copied ? 'var(--green)' : 'var(--gold)',
                color: '#0a0a0c',
              }}
            >
              {copied ? 'Copied!' : 'Copy Message'}
            </button>

            {listing.seller_phone && (
              <a
                href={`tel:${listing.seller_phone}`}
                className="px-3 py-1.5 rounded text-xs font-medium no-underline transition-colors"
                style={{
                  background: 'var(--bg-surface)',
                  color: 'var(--blue)',
                  border: '1px solid var(--border)',
                }}
              >
                Call {listing.seller_phone}
              </a>
            )}

            {listing.source_url && (
              <a
                href={listing.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded text-xs font-medium no-underline transition-colors"
                style={{
                  background: 'var(--bg-surface)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border)',
                }}
              >
                View Original Listing
              </a>
            )}
          </div>
        </div>
      )}

      {/* Copied toast */}
      {copied && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded text-sm font-medium z-[100] animate-fade-in"
          style={{
            background: 'var(--green)',
            color: '#0a0a0c',
          }}
        >
          Message copied to clipboard
        </div>
      )}
    </div>
  );
}

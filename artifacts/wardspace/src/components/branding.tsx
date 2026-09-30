import { branding } from '@/lib/branding';

export function BrandIdentity({ compact = false, board = false }: { compact?: boolean; board?: boolean }) {
  return <span className={`brand-identity min-w-0 max-w-full ${board ? 'brand-identity-board' : ''}`}>
    <span className="brand-product">{branding.productName}</span>
    <span className="brand-service whitespace-normal break-words">{branding.serviceName}</span>
    {!compact && <span className="brand-site whitespace-normal break-words">{branding.siteName}</span>}
    {!compact && <span className="brand-organisation">
      {branding.organisationLogo && <img src={branding.organisationLogo} alt="" className="brand-approved-logo" />}
      <span>{branding.organisationName}<span className="brand-welsh">{branding.organisationNameCy}</span></span>
    </span>}
  </span>;
}

export function PrototypeLabel() {
  return branding.prototype ? <span className="prototype-label" aria-label="Independent prototype">Prototype</span> : null;
}
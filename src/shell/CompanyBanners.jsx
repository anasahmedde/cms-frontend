// Global banner strip: platform announcements (all users) + subscription
// expiration warnings (company users). Wraps the legacy banner components
// until they are ported; owns the 60s expiration-status poll the old App.js
// used to run.
import React, { useEffect, useState } from "react";
import { apiGet } from "../lib/api";
import { useAuth } from "../lib/auth";
import GlobalAnnouncementBanner from "../components/GlobalAnnouncementBanner";
import { ExpirationBanner } from "../components/ExpirationNotificationBanner";

export function useCompanyExpiration() {
  const { user, isPlatform, isImpersonating } = useAuth();
  const [status, setStatus] = useState(null);

  useEffect(() => {
    const isCompanyContext = user && (!isPlatform || isImpersonating);
    if (!isCompanyContext) {
      setStatus(null);
      return;
    }
    let cancelled = false;
    const fetchStatus = async () => {
      const res = await apiGet("/company/expiration-status");
      if (!cancelled && res.ok) {
        setStatus({
          expires_at: res.data.expires_at,
          expiration_status: res.data.status,
          days_until_expiration: res.data.days_remaining,
          grace_period_days: res.data.days_remaining,
          company_name: res.data.company_name,
        });
      }
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 60000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user, isPlatform, isImpersonating]);

  return status;
}

export default function CompanyBanners({ expiration }) {
  const { isPlatform } = useAuth();
  return (
    <>
      <GlobalAnnouncementBanner />
      {!isPlatform && expiration && <ExpirationBanner companyStatus={expiration} />}
    </>
  );
}

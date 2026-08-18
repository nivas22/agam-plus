'use client';

import DesktopAppointmentsPage from '@/app/hospital/[id]/appointments/page';
import MobilePageWrapper from '@/components/mobile/MobilePageWrapper';

export default function MobileAppointmentsPage() {
  return (
    <MobilePageWrapper hideViewSwitch>
      <DesktopAppointmentsPage />
    </MobilePageWrapper>
  );
}

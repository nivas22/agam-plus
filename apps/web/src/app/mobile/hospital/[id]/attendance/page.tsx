'use client';

import DesktopAttendancePage from '@/app/hospital/[id]/attendance/page';
import MobilePageWrapper from '@/components/mobile/MobilePageWrapper';

export default function MobileAttendancePage() {
  return (
    <MobilePageWrapper>
      <DesktopAttendancePage />
    </MobilePageWrapper>
  );
}

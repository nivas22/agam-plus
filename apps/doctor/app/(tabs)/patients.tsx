import React from 'react';
import { ListGroup, Row, Screen, SectionHeader, TokenBadge } from '@agam/mobile-ui';
import { todayAppointments } from '@/data/demo';

export default function Patients() {
  return (
    <Screen title="Patients" subtitle="Everyone you've seen here">
      <SectionHeader>On today's list</SectionHeader>
      <ListGroup>
        {todayAppointments.map((a) => (
          <Row
            key={a.id}
            leading={<TokenBadge token={a.token} />}
            title={a.name}
            subtitle={`${a.ageSex} · ${a.reason}`}
            chevron
            onPress={() => {}}
          />
        ))}
      </ListGroup>
    </Screen>
  );
}

import React, { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Button,
  ChoiceRow,
  Chip,
  IconButton,
  ListGroup,
  Row,
  Screen,
  SectionHeader,
  Snackbar,
  Txt,
  color,
  isIOS,
  space,
  type as typeScale,
} from '@agam/mobile-ui';
import { finishVisit } from '@/data/demo';

const FOLLOW_UPS = ['None', '1 week', '2 weeks', '1 month'] as const;
type FollowUp = (typeof FOLLOW_UPS)[number];

export default function FinishVisit() {
  const router = useRouter();

  const [notes, setNotes] = useState(finishVisit.notes);
  const [followUp, setFollowUp] = useState<FollowUp>('1 week');
  const [inserted, setInserted] = useState<string[]>([finishVisit.quickInserts[0]]);
  const [saved, setSaved] = useState(false);

  const toggleInsert = (label: string) =>
    setInserted((prev) =>
      prev.includes(label) ? prev.filter((x) => x !== label) : [...prev, label],
    );

  const save = () => {
    setSaved(true);
    if (isIOS) router.back();
  };

  return (
    <Screen
      modal={{
        title: 'Finish visit',
        cancel: { label: 'Cancel', onPress: () => router.back() },
        confirm: { label: isIOS ? 'Done' : 'Save', onPress: save },
      }}
      footer={
        isIOS ? <Button label="Sign prescription & complete" onPress={save} /> : null
      }
      overlay={
        <Snackbar
          visible={saved}
          message="Notes saved to this device"
          actionLabel="Undo"
          onAction={() => setSaved(false)}
          onDismiss={() => setSaved(false)}
        />
      }
    >
      <View style={styles.section}>
        <SectionHeader>{isIOS ? 'Notes' : 'Session notes'}</SectionHeader>
        {/*
          iOS: a plain white card, the field indistinguishable from the page.
          Material: a filled text field with a tinted surface and the brand
          underline that marks the focused input.
        */}
        <View style={isIOS ? styles.noteIOS : styles.noteMD}>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            multiline
            textAlignVertical="top"
            accessibilityLabel="Session notes"
            style={[styles.input, typeScale.body, { color: color.ink }]}
          />
          <IconButton icon="mic-outline" accessibilityLabel="Dictate note" style={styles.mic} />
        </View>

        <View style={styles.chips}>
          {finishVisit.quickInserts.map((label) => (
            <Chip
              key={label}
              label={label}
              selected={inserted.includes(label)}
              onPress={() => toggleInsert(label)}
            />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader>Given during the visit</SectionHeader>
        <ListGroup>
          {finishVisit.given.map((item) => (
            <Row key={item.label} title={item.label} value={`₹${item.amount}`} />
          ))}
          <Row
            title={isIOS ? 'Add injection or test' : '+ Add injection or test'}
            tone="brand"
            chevron
            onPress={() => {}}
          />
        </ListGroup>
      </View>

      <View style={styles.section}>
        <SectionHeader>Follow-up</SectionHeader>
        <ChoiceRow options={FOLLOW_UPS} value={followUp} onChange={setFollowUp} />
      </View>

      {/*
        Stated plainly because the doctor's phone never takes money — without
        this the ₹150 above reads like something they are expected to collect.
      */}
      <Txt variant="secondary" tone="ink3">
        The front desk takes the payment. Nothing on your phone handles cash.
      </Txt>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  noteIOS: {
    backgroundColor: color.card,
    borderRadius: 10,
    padding: space.md,
    minHeight: 150,
  },
  noteMD: {
    backgroundColor: color.surface,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomWidth: 2,
    borderBottomColor: color.brand,
    padding: space.md,
    minHeight: 150,
  },
  input: { flex: 1, minHeight: 110, paddingRight: 44 },
  mic: { position: 'absolute', right: space.md, bottom: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.xs },
});

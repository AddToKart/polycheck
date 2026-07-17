import { useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { api } from '../../services/api-client'
import { fonts } from '../../theme/typography'
import { useTheme } from '../../theme/ThemeContext'
import type { Student, Section, Session, Subject } from '@polycheck/shared'

type Results = {
  students: Student[]
  sections: Section[]
  sessions: Session[]
}

export default function FacultySearchScreen() {
  const { isDark } = useTheme()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Results>({ students: [], sections: [], sessions: [] })
  const [searched, setSearched] = useState(false)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const inputRef = useRef<TextInput>(null)

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 200)
    void api.getSubjects().then(setSubjects)
  }, [])

  const handleSearch = (q: string) => {
    setQuery(q)
    if (q.trim().length > 0) {
      void api.search(q).then((nextResults) => {
        setResults(nextResults)
        setSearched(true)
      })
    } else {
      setResults({ students: [], sections: [], sessions: [] })
      setSearched(false)
    }
  }

  const totalResults = results.students.length + results.sections.length + results.sessions.length

  const accent = isDark ? '#FFDF00' : '#7B1113'
  const accentText = isDark ? '#4A0A0B' : '#FFFFFF'
  const bg = isDark ? '#0A0A0C' : '#F5F5F5'
  const cardBg = isDark ? '#121215' : '#FFFFFF'
  const cardBorder = isDark ? 'rgba(245,168,0,0.15)' : '#E8E8E8'
  const textPrimary = isDark ? '#FFFFFF' : '#1A1A1A'
  const textSecondary = isDark ? 'rgba(255,255,255,0.5)' : '#888888'
  const inputBg = isDark ? '#1A1A1E' : '#FFFFFF'
  const inputBorder = isDark ? 'rgba(255,255,255,0.1)' : '#DDD'

  const SectionHeader = ({ icon, label, count }: { icon: keyof typeof MaterialIcons.glyphMap; label: string; count: number }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: cardBorder, marginBottom: 8, marginTop: 16 }}>
      <MaterialIcons name={icon} size={14} color={accent} />
      <Text style={{ fontSize: 10, fontWeight: '700', fontFamily: fonts.bodyBold, color: textSecondary, textTransform: 'uppercase', letterSpacing: 1 }}>
        {label} ({count})
      </Text>
    </View>
  )

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: isDark ? '#0A0A0C' : '#FFFFFF', borderBottomColor: cardBorder }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Go back">
          <MaterialIcons name="arrow-back" size={22} color={accent} />
        </TouchableOpacity>

        {/* Search input */}
        <View style={[styles.searchBox, { backgroundColor: inputBg, borderColor: inputBorder }]}>
          <MaterialIcons name="search" size={18} color={textSecondary} />
          <TextInput
            ref={inputRef}
            style={[styles.searchInput, { color: textPrimary }]}
            value={query}
            onChangeText={handleSearch}
            placeholder="Search students, sections, sessions…"
            placeholderTextColor={textSecondary}
            returnKeyType="search"
            clearButtonMode="while-editing"
            autoCorrect={false}
            autoCapitalize="none"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => handleSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <MaterialIcons name="close" size={16} color={textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100, paddingTop: 8 }} keyboardShouldPersistTaps="handled">
        {/* Results count */}
        {searched && query && (
          <Text style={{ fontSize: 10, fontWeight: '700', color: textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 8, marginBottom: 4 }}>
            {totalResults === 0 ? `No results for "${query}"` : `${totalResults} result${totalResults !== 1 ? 's' : ''} for "${query}"`}
          </Text>
        )}

        {/* Empty / idle state */}
        {!searched && (
          <View style={{ alignItems: 'center', paddingTop: 80 }}>
            <View style={{ width: 56, height: 56, borderWidth: 2, borderStyle: 'dashed', borderColor: cardBorder, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <MaterialIcons name="search" size={24} color={textSecondary} />
            </View>
            <Text style={{ fontSize: 14, fontWeight: '600', color: textSecondary, textAlign: 'center' }}>
              Search students, sections, and sessions
            </Text>
          </View>
        )}

        {/* Students */}
        {results.students.length > 0 && (
          <>
            <SectionHeader icon="people" label="Students" count={results.students.length} />
            {results.students.map((s) => (
              <TouchableOpacity
                key={s.id}
                style={[styles.resultCard, { backgroundColor: cardBg, borderColor: cardBorder }]}
                onPress={() => router.push(`/(faculty)/student/${s.id}` as any)}
                activeOpacity={0.7}
              >
                <View style={[styles.avatar, { backgroundColor: accent }]}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: accentText }}>
                    {s.fullName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', fontFamily: fonts.bodySemiBold, color: textPrimary }}>{s.fullName}</Text>
                  <Text style={{ fontSize: 12, fontFamily: fonts.body, color: textSecondary, marginTop: 1 }}>{s.studentId} · {s.program}</Text>
                </View>
                <MaterialIcons name="chevron-right" size={18} color={textSecondary} />
              </TouchableOpacity>
            ))}
          </>
        )}

        {/* Sections */}
        {results.sections.length > 0 && (
          <>
            <SectionHeader icon="menu-book" label="Sections" count={results.sections.length} />
            {results.sections.map((sec) => {
              const subj = subjects.find((s: Subject) => s.id === sec.subjectId)
              return (
                <TouchableOpacity
                  key={sec.id}
                  style={[styles.resultCard, { backgroundColor: cardBg, borderColor: cardBorder }]}
                  onPress={() => router.push(`/(faculty)/sections/${sec.id}` as any)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.avatarBorder, { borderColor: accent }]}>
                    <MaterialIcons name="menu-book" size={18} color={accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', fontFamily: fonts.bodySemiBold, color: textPrimary }}>{subj?.name ?? 'Unknown'}</Text>
                    <Text style={{ fontSize: 12, fontFamily: fonts.body, color: textSecondary, marginTop: 1 }}>
                      {subj?.code} · Sec {sec.section}{sec.room ? ` · ${sec.room}` : ''}
                    </Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={18} color={textSecondary} />
                </TouchableOpacity>
              )
            })}
          </>
        )}

        {/* Sessions */}
        {results.sessions.length > 0 && (
          <>
            <SectionHeader icon="event" label="Sessions" count={results.sessions.length} />
            {results.sessions.map((sess) => (
              <TouchableOpacity
                key={sess.id}
                style={[styles.resultCard, { backgroundColor: cardBg, borderColor: cardBorder }]}
                onPress={() => router.push(`/(faculty)/sessions/${sess.id}` as any)}
                activeOpacity={0.7}
              >
                <View style={[styles.avatarBorder, { borderColor: accent }]}>
                  <MaterialIcons name="event" size={18} color={accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', fontFamily: fonts.bodySemiBold, color: textPrimary }}>{sess.subjectName}</Text>
                  <Text style={{ fontSize: 12, fontFamily: fonts.body, color: textSecondary, marginTop: 1 }}>
                    {sess.date} · {sess.startTime}–{sess.endTime}
                    {sess.isActive ? ' · ACTIVE' : ''}
                  </Text>
                </View>
                <MaterialIcons name="chevron-right" size={18} color={textSecondary} />
              </TouchableOpacity>
            ))}
          </>
        )}

        {/* No results */}
        {searched && totalResults === 0 && query && (
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <View style={{ width: 48, height: 48, borderWidth: 2, borderStyle: 'dashed', borderColor: cardBorder, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <MaterialIcons name="search-off" size={20} color={textSecondary} />
            </View>
            <Text style={{ fontSize: 14, fontWeight: '600', color: textSecondary }}>No results found</Text>
            <Text style={{ fontSize: 12, color: textSecondary, marginTop: 4, textAlign: 'center' }}>
              Try a different name, student ID, subject code, or date.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, gap: 12 },
  backBtn: { padding: 4 },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, paddingHorizontal: 12, height: 40 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: 'DMSans_400Regular', paddingVertical: 0 },
  resultCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderWidth: 1, marginBottom: 6 },
  avatar: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarBorder: { width: 38, height: 38, borderWidth: 2, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
})

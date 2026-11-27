/// Mirrors `shared/src/constants/ai-terms.ts`; `ai_terms_test.dart` fails when
/// the two drift apart.
library;

const String aiTermsVersion = '1.0';

const String aiTermsTitle = 'Before you use the AI assistant';

const String aiTermsIntro =
    'The assistant is optional. Please read how your information is handled, then choose whether to continue.';

class AiTermsSection {
  const AiTermsSection(this.heading, this.points);

  final String heading;
  final List<String> points;
}

const List<AiTermsSection> aiTermsSections = <AiTermsSection>[
  AiTermsSection('What is sent to the AI provider', <String>[
    'Your message, earlier messages in the same chat, and the records the assistant looks up to answer you are sent to an outside AI provider chosen by your school.',
    'Students: your own subjects, your professor’s name and your own attendance figures.',
    'Teachers: details of your own classes and sessions, including your name, courses, rooms, schedules and attendance counts.',
    'Administrators: details of the classes they oversee, accounts they search for (such as name, email, student number and course) and recent activity entries with names.',
  ]),
  AiTermsSection('What the assistant is not given', <String>[
    'Master lists and attendance files are made by PolyCheck. The contents of those files are not sent to the AI provider.',
    'PolyCheck does not give the assistant your password, your GPS location or your device details.',
  ]),
  AiTermsSection('What is kept, and by whom', <String>[
    'The AI provider handles what it receives under its own terms and privacy policy. PolyCheck cannot control how long the provider keeps it.',
    'PolyCheck keeps each chat so you can return to it. A chat is deleted automatically 7 days after its last message, and you can delete it sooner.',
    'PolyCheck’s activity log records that the assistant was used, which look-ups ran and whether they worked. It does not record the text of your messages.',
    'PolyCheck does not sell your information and does not use your chats to train AI models.',
  ]),
  AiTermsSection('Using it responsibly', <String>[
    'The assistant can make mistakes. Check important answers against your records.',
    'Do not type passwords or sensitive personal information into the chat.',
    'Your school sets how many messages you can send each day.',
    'If you do not agree, do not use the assistant. The rest of PolyCheck works the same.',
  ]),
];

const String aiTermsAcceptLabel = 'I agree and continue';

/// Error code for a message sent before the current terms are accepted.
const String aiTermsRequiredCode = 'ai_terms_required';

const int aiDailyLimitMax = 1000;

/// Used until a super admin saves a value.
const int aiDailyLimitStudentDefault = 10;
const int aiDailyLimitTeacherDefault = 20;
const int aiDailyLimitSuperAdminDefault = 100;

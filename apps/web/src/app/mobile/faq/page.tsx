'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ChevronDown, 
  ChevronUp, 
  HelpCircle, 
  Search,
  ArrowLeft,
  Calendar,
  Users,
  MessageCircle,
  Shield
} from 'lucide-react';

interface FAQItem {
  question: string;
  answer: string;
  category: string;
}

const faqData: FAQItem[] = [
  // General Questions
  {
    category: 'General',
    question: 'What is this hospital management system?',
    answer: 'This is a comprehensive hospital management system designed to streamline appointments, patient records, and doctor schedules. It helps healthcare providers manage their practice efficiently while providing patients with easy access to medical services.'
  },
  {
    category: 'General',
    question: 'Who can use this platform?',
    answer: 'The platform is designed for three main user types: Hospital Administrators who manage the overall system, Doctors who handle patient appointments and medical records, and Patients who can book appointments and access their health information.'
  },
  {
    category: 'General',
    question: 'Is my data secure?',
    answer: 'Yes, we take data security very seriously. All patient information is encrypted and stored securely. We comply with healthcare data protection regulations and use industry-standard security measures to protect your information.'
  },
  
  // Appointments
  {
    category: 'Appointments',
    question: 'How do I book an appointment?',
    answer: 'To book an appointment, navigate to the Appointments section, select your preferred doctor and date, choose an available time slot, and confirm your booking. You will receive a confirmation notification once the appointment is scheduled.'
  },
  {
    category: 'Appointments',
    question: 'Can I reschedule or cancel an appointment?',
    answer: 'Yes, you can reschedule or cancel appointments through the Appointments page. Please note that cancellations should be made at least 24 hours in advance when possible to allow other patients to book that slot.'
  },
  {
    category: 'Appointments',
    question: 'What happens if I miss an appointment?',
    answer: 'If you miss an appointment without prior cancellation, it will be marked as "missed" in the system. We recommend contacting the hospital to reschedule. Repeated missed appointments may affect your ability to book future appointments.'
  },
  {
    category: 'Appointments',
    question: 'How do I know if my appointment is confirmed?',
    answer: 'Once your appointment is booked, you will see it in your appointments list with a "Scheduled" status. You can also check the appointment details at any time from your dashboard.'
  },
  
  // For Doctors
  {
    category: 'For Doctors',
    question: 'How do I set my availability?',
    answer: 'Go to your Profile page and click on the "Edit" button in the Weekly Schedule section. You can set your available days and time slots for each day of the week. Make sure to save your changes.'
  },
  {
    category: 'For Doctors',
    question: 'How do I view my appointments?',
    answer: 'Your dashboard displays all upcoming appointments. You can also navigate to the Appointments page to see a detailed list of all appointments, including past, current, and upcoming ones.'
  },
  {
    category: 'For Doctors',
    question: 'Can I update my professional information?',
    answer: 'Yes, you can update your specialization, qualification, experience, and bio by clicking the Edit button on your profile page. This information will be visible to patients when they book appointments.'
  },
  {
    category: 'For Doctors',
    question: 'How do I manage patient records?',
    answer: 'You can access patient records through the Patients section. Each patient profile contains their appointment history, medical notes, and contact information. You can add notes and update records after each consultation.'
  },
  
  // For Patients
  {
    category: 'For Patients',
    question: 'How do I find a doctor?',
    answer: 'You can browse available doctors by specialty, view their profiles including qualifications and experience, and check their available time slots before booking an appointment.'
  },
  {
    category: 'For Patients',
    question: 'Can I see my appointment history?',
    answer: 'Yes, all your past and upcoming appointments are available in the Appointments section. You can view details of each appointment including date, time, doctor, and appointment status.'
  },
  {
    category: 'For Patients',
    question: 'What if I need to contact my doctor?',
    answer: 'You can view your doctor\'s contact information in their profile. For urgent matters, please contact the hospital directly using the contact information provided in the system.'
  },
  
  // Technical Support
  {
    category: 'Technical Support',
    question: 'I forgot my password. What should I do?',
    answer: 'Click on the "Forgot Password" link on the login page. Enter your registered email address, and you will receive instructions to reset your password.'
  },
  {
    category: 'Technical Support',
    question: 'The app is not working properly. What should I do?',
    answer: 'Try refreshing the page or logging out and back in. If the problem persists, please contact technical support with details about the issue you\'re experiencing.'
  },
  {
    category: 'Technical Support',
    question: 'Can I use this on my mobile device?',
    answer: 'Yes, the platform is fully responsive and works on mobile devices, tablets, and desktop computers. We recommend using the latest version of your web browser for the best experience.'
  },
  {
    category: 'Technical Support',
    question: 'How do I update my contact information?',
    answer: 'Go to your Profile page and click the Edit button. You can update your phone number, email address, and other contact details. Make sure to save your changes.'
  }
];

const categories = ['All', 'General', 'Appointments', 'For Doctors', 'For Patients', 'Technical Support'];

export default function MobileFAQPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const filteredFAQs = faqData.filter(faq => {
    const matchesSearch = faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || faq.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const toggleExpand = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'General':
        return <HelpCircle className="w-4 h-4" />;
      case 'Appointments':
        return <Calendar className="w-4 h-4" />;
      case 'For Doctors':
        return <Users className="w-4 h-4" />;
      case 'For Patients':
        return <MessageCircle className="w-4 h-4" />;
      case 'Technical Support':
        return <Shield className="w-4 h-4" />;
      default:
        return <HelpCircle className="w-4 h-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-4 pt-6 pb-8 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => router.back()}
            className="p-2 -ml-2 hover:bg-white/10 rounded-lg transition-colors active:scale-95"
            aria-label="Go back"
          >
            <ArrowLeft size={20} className="text-white" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white">FAQ</h1>
            <p className="text-purple-100 text-xs">Find answers to common questions</p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border-0 rounded-xl focus:ring-2 focus:ring-purple-300 outline-none text-sm"
          />
        </div>
      </div>

      <div className="px-4 py-4">
        {/* Category Filter */}
        <div className="flex gap-2 overflow-x-auto pb-3 mb-4 scrollbar-hide -mx-4 px-4">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                selectedCategory === category
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'bg-white text-gray-700 border border-gray-200'
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {/* FAQ List */}
        {filteredFAQs.length === 0 ? (
          <div className="text-center py-12">
            <HelpCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-gray-900 mb-1">No results found</h3>
            <p className="text-sm text-gray-600">Try adjusting your search or filter</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredFAQs.map((faq, index) => (
              <div
                key={index}
                className="bg-white rounded-2xl shadow-sm overflow-hidden"
              >
                <button
                  onClick={() => toggleExpand(index)}
                  className="w-full px-4 py-3 flex items-start justify-between gap-3 text-left active:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start gap-2.5 flex-1">
                    <div className="mt-0.5 text-purple-600">
                      {getCategoryIcon(faq.category)}
                    </div>
                    <div className="flex-1">
                      <span className="text-xs font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full inline-block mb-1.5">
                        {faq.category}
                      </span>
                      <h3 className="text-sm font-semibold text-gray-900 leading-snug">
                        {faq.question}
                      </h3>
                    </div>
                  </div>
                  <div className="flex-shrink-0 mt-1">
                    {expandedIndex === index ? (
                      <ChevronUp className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </button>
                
                {expandedIndex === index && (
                  <div className="px-4 pb-4">
                    <div className="pl-6 text-sm text-gray-700 leading-relaxed">
                      {faq.answer}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Contact Support */}
        <div className="mt-8 bg-gradient-to-r from-purple-600 to-purple-700 rounded-2xl p-6 text-center text-white shadow-lg">
          <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-3">
            <HelpCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold mb-2">Still have questions?</h2>
          <p className="text-purple-100 text-sm mb-4">
            Can't find the answer you're looking for?
          </p>
          <button
            onClick={() => {/* Add contact support logic */}}
            className="px-5 py-2.5 bg-white text-purple-600 font-semibold rounded-xl hover:bg-purple-50 transition-colors shadow-md text-sm active:scale-95"
          >
            Contact Support
          </button>
        </div>
      </div>
    </div>
  );
}

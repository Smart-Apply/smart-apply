import type { ResumeData } from '@/types';
import { sanitizeHtml } from '@/lib/sanitize';
import styles from './resume-preview.module.css';

interface ResumePreviewProps {
  resume: ResumeData;
}

const Divider = () => <div className="h-px w-full bg-slate-200 my-6" />;

export function ResumePreview({ resume }: ResumePreviewProps) {
  const contactItems = [
    resume.email,
    resume.phone,
    resume.location,
    resume.linkedin,
    resume.github,
  ].filter(Boolean);

  return (
    <div className={styles.previewWrapper}>
      <div className={styles.previewScroll}>
        <article className={styles.previewPage}>
          <header className={styles.header}>
            <h1 className={styles.headerName}>{resume.candidateName || 'Dein Name'}</h1>
            {contactItems.length > 0 && (
              <div className={styles.contactInfo}>
                {contactItems.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            )}
          </header>

          {resume.summary && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Kurzprofil</h2>
              <div
                className={styles.summary}
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(resume.summary) }}
              />
            </section>
          )}

          {resume.skillCategories && resume.skillCategories.length > 0 && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Skills</h2>
              <div className={styles.skillsGrid}>
                {resume.skillCategories.map((category, index) => (
                  <div key={category._key || category.id || category.type || `skill-cat-${index}`} className={styles.skillCategory}>
                    <p className={styles.skillCategoryTitle}>{category.type}</p>
                    <div className={styles.skillTags}>
                      {category.skills.map((skill) => (
                        <span key={skill} className={styles.skillTag}>
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {resume.experiences && resume.experiences.length > 0 && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Erfahrung</h2>
              {resume.experiences.map((experience) => (
                <div key={experience.id || experience.title} className={styles.timelineItem}>
                  <div className={styles.timelineHeader}>
                    <span>{experience.title}</span>
                    <span className="text-sm text-slate-500">{experience.dateRange}</span>
                  </div>
                  <p className={styles.timelineCompany}>
                    {experience.company}
                    {experience.location ? ` • ${experience.location}` : ''}
                  </p>
                  {experience.achievements && experience.achievements.length > 0 && (
                    <ul className={styles.timelineList}>
                      {experience.achievements.map((achievement, index) => (
                        <li key={`${experience.id}-${index}`}>{achievement}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </section>
          )}

          {resume.projects && resume.projects.length > 0 && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Projekte</h2>
              {resume.projects.map((project) => (
                <div key={project.id || project.name} className="mb-3 rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center justify-between text-sm font-semibold">
                    <span>{project.name}</span>
                    {project.date && <span className="text-slate-500">{project.date}</span>}
                  </div>
                  {project.description && (
                    <p className="mt-2 text-sm text-slate-600">{project.description}</p>
                  )}
                  {project.highlights && project.highlights.length > 0 && (
                    <ul className="mt-2 list-disc pl-4 text-sm text-slate-700">
                      {project.highlights.map((highlight, index) => (
                        <li key={`${project.id}-${index}`}>{highlight}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </section>
          )}

          {resume.education && resume.education.length > 0 && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Ausbildung</h2>
              {resume.education.map((education) => (
                <div key={education.id || education.degree} className="mb-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{education.degree}</p>
                    <span className="text-sm text-slate-500">{education.year}</span>
                  </div>
                  <p className="text-sm text-slate-600">{education.institution}</p>
                  {education.fieldOfStudy && (
                    <p className="text-sm text-slate-500">{education.fieldOfStudy}</p>
                  )}
                  {education.description && (
                    <p className="mt-1 text-sm text-slate-600">{education.description}</p>
                  )}
                </div>
              ))}
            </section>
          )}

          {resume.certifications && resume.certifications.length > 0 && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Zertifizierungen</h2>
              {resume.certifications.map((cert) => (
                <div key={cert.id || cert.name} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm">
                  <div>
                    <p className="font-semibold">{cert.name}</p>
                    <p className="text-slate-600">{cert.issuer}</p>
                  </div>
                  {cert.date && <span className="text-slate-500">{cert.date}</span>}
                </div>
              ))}
            </section>
          )}

          <Divider />
          <p className="text-center text-xs text-slate-400">HTML-Vorschau · Finales PDF wird während des Exports gerendert</p>
        </article>
      </div>
    </div>
  );
}

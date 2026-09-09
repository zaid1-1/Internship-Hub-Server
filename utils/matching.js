// Plain rule-based match calculation - NOT a database query, so this is
// where the fixed weights from the project spec get applied (Skills 40 /
// Career Field 25 / Location 15 / Internship Type 10 / Education 10).
// Deliberately written with nothing beyond variables, if/else and plain
// for loops - the same level of JS already used everywhere else in this
// project. No array helper methods (.filter/.reduce/etc.), no classes.

function calculateMatch(student, internship) {
  // ---- Skills: % of the internship's required skills the student has ----
  const requiredSkills = internship.requiredSkills;
  const studentSkills = student.skillIds;

  const matchingSkills = [];
  const missingSkills = [];

  for (let i = 0; i < requiredSkills.length; i++) {
    const required = requiredSkills[i];
    let hasIt = false;
    for (let j = 0; j < studentSkills.length; j++) {
      if (studentSkills[j].id === required.id) {
        hasIt = true;
        break;
      }
    }
    if (hasIt) {
      matchingSkills.push(required);
    } else {
      missingSkills.push(required);
    }
  }

  let skillsPercent;
  if (requiredSkills.length === 0) {
    skillsPercent = 100;
  } else {
    skillsPercent = (matchingSkills.length / requiredSkills.length) * 100;
  }

  // ---- Career field: is this internship's field one of the student's
  // listed career interests? ----
  let fieldPercent = 100;
  if (internship.field_id) {
    let hasInterest = false;
    for (let i = 0; i < student.interestFieldIds.length; i++) {
      if (student.interestFieldIds[i] === internship.field_id) {
        hasInterest = true;
        break;
      }
    }
    fieldPercent = hasInterest ? 100 : 0;
  }

  // ---- Location: does it match the student's preferred location? ----
  // (no penalty if either side hasn't set one)
  let locationPercent = 100;
  if (internship.location_id && student.preferred_location_id) {
    locationPercent =
      internship.location_id === student.preferred_location_id ? 100 : 0;
  }

  // ---- Internship type: Summer/Semester/Full-time/Part-time preference ----
  let typePercent = 100;
  if (internship.internship_type_id && student.preferred_internship_type_id) {
    typePercent =
      internship.internship_type_id === student.preferred_internship_type_id
        ? 100
        : 0;
  }

  // ---- Education: required field of study, if the internship sets one ----
  let educationPercent = 100;
  if (internship.required_study_field_id) {
    educationPercent =
      internship.required_study_field_id === student.study_field_id
        ? 100
        : 0;
  }

  const score = Math.round(
    skillsPercent * 0.4 +
      fieldPercent * 0.25 +
      locationPercent * 0.15 +
      typePercent * 0.1 +
      educationPercent * 0.1
  );

  return {
    score,
    breakdown: {
      skills: Math.round(skillsPercent),
      field: Math.round(fieldPercent),
      location: Math.round(locationPercent),
      type: Math.round(typePercent),
      education: Math.round(educationPercent),
    },
    matchingSkills,
    missingSkills,
  };
}

export default calculateMatch;
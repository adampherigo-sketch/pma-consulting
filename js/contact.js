document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("#contact-form");
  const submitButton = form.querySelector(".submit-button");
  const formStatus = document.querySelector("#contact-form-status");
  let isSubmitting = false;
  const contactChoices = document.querySelectorAll(
    'input[name="preferred_contact"]'
  );
  const phoneInput = document.querySelector("#phone");
  const phoneRequiredIndicator = document.querySelector(
    "[data-phone-required-indicator]"
  );
  const callbackSection = document.querySelector(
    "#callback-section"
  );
  const callbackInputs = callbackSection.querySelectorAll(
    "input"
  );
  const firstCallbackInputs = [
    document.querySelector("#callback-date-one"),
    document.querySelector("#callback-from-one"),
    document.querySelector("#callback-to-one")
  ];

  const setContactState = (preferredContact) => {
    const wantsPhone = preferredContact === "Phone";

    phoneInput.required = wantsPhone;
    phoneInput.setAttribute("aria-required", String(wantsPhone));
    phoneRequiredIndicator.hidden = !wantsPhone;

    callbackSection.hidden = !wantsPhone;
    callbackSection.setAttribute(
      "aria-hidden",
      String(!wantsPhone)
    );

    callbackInputs.forEach((input) => {
      input.disabled = !wantsPhone;
      input.required = false;
    });

    firstCallbackInputs.forEach((input) => {
      input.required = wantsPhone;
    });
  };

  contactChoices.forEach((choice) => {
    choice.addEventListener("change", () => {
      if (choice.checked) {
        setContactState(choice.value);
      }
    });
  });

  const selectedContact = document.querySelector(
    'input[name="preferred_contact"]:checked'
  );

  if (selectedContact) {
    setContactState(selectedContact.value);
  }

  const projectChoices = document.querySelectorAll(
    "[data-project-choice]"
  );

  const conditionalSections = {
    event: document.querySelector("#event-options"),
    administrative: document.querySelector(
      "#administrative-options"
    ),
    speaking: document.querySelector("#speaking-options")
  };

  const setConditionalSection = (selectedProject) => {
    Object.entries(conditionalSections).forEach(
      ([projectName, section]) => {
        const shouldShow = projectName === selectedProject;

        section.hidden = !shouldShow;

        section
          .querySelectorAll("input")
          .forEach((input) => {
            input.disabled = !shouldShow;
          });
      }
    );
  };

  projectChoices.forEach((choice) => {
    choice.addEventListener("change", () => {
      if (choice.checked) {
        setConditionalSection(
          choice.dataset.projectChoice
        );
      }
    });
  });

  const selectedProject = document.querySelector(
    "[data-project-choice]:checked"
  );

  if (selectedProject) {
    setConditionalSection(
      selectedProject.dataset.projectChoice
    );
  }

  const getValue = (name) => form.elements[name]?.value.trim() || "";

  const getValues = (name) => Array.from(
    form.querySelectorAll(`input[name="${name}"]:checked`)
  ).map((input) => input.value);

  const buildPayload = () => {
    const projectType = getValue("project_type");

    return {
      first_name: getValue("first_name"),
      last_name: getValue("last_name"),
      email: getValue("email"),
      phone: getValue("phone"),
      preferred_contact: getValue("preferred_contact"),
      callback_date_one: getValue("callback_date_one"),
      callback_from_one: getValue("callback_from_one"),
      callback_to_one: getValue("callback_to_one"),
      callback_date_two: getValue("callback_date_two"),
      callback_from_two: getValue("callback_from_two"),
      callback_to_two: getValue("callback_to_two"),
      project_type: projectType,
      event_size: projectType === "Event Planning"
        ? getValue("event_size")
        : "",
      "administrative_services[]": projectType === "Administrative and Process Consultation"
        ? getValues("administrative_services[]")
        : [],
      "speaking_topics[]": projectType === "Speaking Engagement"
        ? getValues("speaking_topics[]")
        : [],
      project_message: getValue("project_message"),
      website: getValue("website")
    };
  };

  const setStatus = (message, type = "") => {
    formStatus.textContent = message;
    formStatus.className = `form-status${type ? ` is-${type}` : ""}`;
  };

  const restoreFormState = () => {
    const contact = form.querySelector(
      'input[name="preferred_contact"]:checked'
    );
    const project = form.querySelector(
      "[data-project-choice]:checked"
    );

    if (contact) {
      setContactState(contact.value);
    }

    if (project) {
      setConditionalSection(project.dataset.projectChoice);
    }
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    isSubmitting = true;
    submitButton.disabled = true;
    submitButton.textContent = "Sending…";
    setStatus("Sending your inquiry…");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 14000);

    try {
      const response = await fetch("/.netlify/functions/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(buildPayload()),
        signal: controller.signal
      });
      let result = null;

      try {
        result = await response.json();
      } catch {
        result = null;
      }

      if (response.ok && result?.ok === true) {
        form.reset();
        restoreFormState();
        setStatus(
          "Thanks for reaching out. Your inquiry has been sent to PMA Consulting.",
          "success"
        );
        formStatus.focus();
        submitButton.disabled = true;
        return;
      }

      setStatus(
        "We couldn't send your inquiry right now. Please try again.",
        "error"
      );
    } catch {
      setStatus(
        "We couldn't send your inquiry right now. Please try again.",
        "error"
      );
    } finally {
      clearTimeout(timeout);
      isSubmitting = false;

      if (!formStatus.classList.contains("is-success")) {
        submitButton.disabled = false;
        submitButton.textContent = "Send My Inquiry";
      }
    }
  });

  const dateInputs = document.querySelectorAll(
    'input[type="date"]'
  );

  const today = new Date();
  const localToday = new Date(
    today.getTime() - today.getTimezoneOffset() * 60000
  )
    .toISOString()
    .split("T")[0];

  dateInputs.forEach((input) => {
    input.min = localToday;
  });
});
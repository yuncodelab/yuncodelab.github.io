# I Built an Android Media Library That Unifies Camera, File Saving, Image Picking, and File Selection into a Single API

English | [中文](mediaaccessx.md)

`MediaAccessX` is an Android media access library that provides a unified abstraction for:

* Taking photos / recording videos
* Saving files to shared storage
* Picking images
* Picking files

It offers a concise DSL-style API and automatically adapts to storage and permission differences across Android versions.

---

# Why Build This Library

In Android development, we frequently deal with several common requirements:

* Taking photos
* Recording videos
* Picking images
* Selecting files
* Saving media or files to shared storage

These tasks may seem straightforward, but real-world implementation involves many edge cases, such as:

* Storage behavior differences across Android versions
* `FileProvider` configuration
* Runtime permission handling
* Lifecycle constraints of the ActivityResult API
* Inconsistent results from different system components

In many projects, these features are implemented via **copy-paste + partial modification**, which leads to scattered code and frequent pitfalls.

---

In practice, a complete camera flow typically includes:

1. Handling runtime permissions
2. Creating a URI based on Android version
3. Registering `ActivityResultLauncher`
4. Launching the system camera
5. Handling the result

If we expand this flow (omitting some details), it often looks like this:

```kotlin
// 1. Handle runtime permissions
if (!hasCameraPermission()) {
    requestCameraPermission()
    return
}

// 2. Create Uri based on Android version
val uri = if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {

    // Below Android 10
    // 1. Create file using File API
    val file = createImageFile()

    // 2. Convert to Uri via FileProvider
    FileProvider.getUriForFile(context, authority, file)

} else {

    // Android 10 and above
    // Use MediaStore to create Uri
    createMediaStoreImageUri()
}

// 3. Register ActivityResultLauncher (must be done early in lifecycle)
val launcher = registerForActivityResult(
    ActivityResultContracts.TakePicture()
) { success ->
    // Check success flag
    // Refresh media store manually on older versions if needed
}

// 4. Launch system camera
launcher.launch(uri)
```

Even this simplified version omits several details, such as:

* `FileProvider` setup
* `MediaStore` insertion logic
* Permission callbacks
* Lifecycle constraints

Yet it already demonstrates that camera functionality involves multiple steps.

---

If your project also includes:

* Image picking
* File selection
* Saving media to shared storage

These pieces of logic often end up scattered across different parts of the codebase.

Individually, they are not complex—but **as a whole, the structure becomes fragmented and harder to maintain**.

---

This leads to a natural question:

**Can these capabilities be unified?**

That’s why I built **MediaAccessX**.

The goal is simple:

**Unify Android media access and provide a cleaner, more ergonomic API.**

---

# Design Goals

MediaAccessX focuses on a few key design goals.

---

## 1. Unified API

Provide a consistent abstraction for:

* Camera
* Saver
* PhotoPicker
* FilePicker

Avoid maintaining multiple utility classes across the project.

---

## 2. DSL-Style API

The API is designed to be concise and expressive.

Taking a photo:

```kotlin
MediaAccessX.with(activity)
    .camera()
    .launch { /* handle result */ }
```

Saving a file:

```kotlin
MediaAccessX.with(activity)
    .saver()
    .launch { /* handle result */ }
```

Picking images:

```kotlin
MediaAccessX.with(activity)
    .photoPicker()
    .maxCount(5)
    .launch { /* handle result */ }
```

Picking files:

```kotlin
MediaAccessX.with(activity)
    .filePicker()
    .launch { /* handle result */ }
```

All features follow the same structure:

```
MediaAccessX
   ↓
Feature
   ↓
Configuration
   ↓
launch()
```

This design provides two clear benefits:

* Intuitive API usage
* Consistency across different features

---

## 3. Abstracting System Complexity

The library internally handles:

* Android version differences
* MediaStore / FileProvider
* ActivityResult API
* Permission requests

Developers can focus on business logic without dealing with system-level complexity.

---

# Internal Architecture Overview

To support these features, MediaAccessX introduces a modular internal architecture.

The execution flow is roughly:

```
MediaAccessX
     │
     ▼
MediaAccessXEngine
     │
     ▼
Builder API
(Camera / Saver / PhotoPicker / FilePicker)
     │
     ▼
Permission Executor
     │
     ▼
Media Executors
(Camera / Saver / PhotoPicker / FilePicker)
     │
     ▼
MediaActivityResultFragment
     │
     ▼
ActivityResultLauncher
     │
     ▼
System Apps
     │
     ▼
Result Callback
```

This can be summarized as:

1. Collect configuration via API
2. Perform permission checks
3. Execute corresponding media logic
4. Launch system components via Fragment
5. Receive ActivityResult callback

---

## Builder + Executor Pattern

All features in MediaAccessX follow a unified pattern:

```
Builder → Executor
```

* **Builder**: collects configuration
* **Executor**: performs execution

For example:

| Feature     | Builder            | Executor            |
| ----------- | ------------------ | ------------------- |
| Camera      | CameraBuilder      | CameraExecutor      |
| Saver       | SaverBuilder       | SaverExecutor       |
| PhotoPicker | PhotoPickerBuilder | PhotoPickerExecutor |
| FilePicker  | FilePickerBuilder  | FilePickerExecutor  |

This cleanly separates configuration from execution, making responsibilities explicit and maintainable.

---

## Headless Fragment for ActivityResult

The ActivityResult API has a key constraint:

> `registerForActivityResult()` must be called before the Fragment or Activity is created, and launching is only allowed after the Lifecycle reaches CREATED.

This makes dynamic usage error-prone.

To safely encapsulate ActivityResult, MediaAccessX introduces a **Headless Fragment**:

```
MediaActivityResultFragment
```

This Fragment is responsible for:

* Registering ActivityResultLauncher
* Launching system intents
* Receiving results

This approach enables:

* Non-intrusive integration
* Automatic lifecycle handling
* Zero additional setup for developers

From the developer’s perspective, this Fragment is completely transparent.

---

# Summary

The goal of MediaAccessX is straightforward:

**Unify Android media access and provide a simpler API.**

Through a DSL-style interface, it standardizes:

* Camera
* Saver
* PhotoPicker
* FilePicker

Developers can ultimately write minimal code:

```kotlin
MediaAccessX.with(activity)
    .camera()
    .launch { /* handle result */ }
```

If your project frequently involves camera, media picking, or file handling, **MediaAccessX** can help reduce repetitive work and improve consistency.

---

# Project

GitHub:
[https://github.com/yuncodelab/mediaaccessx](https://github.com/yuncodelab/mediaaccessx)

Feel free to star the repository or open an issue to help improve the project.

// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint, type=warning, deprecated_member_use, deprecated_member_use_from_same_package
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'ai.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$AiChatAttachment {

 String get id; AiAttachmentKind get kind; AiAttachmentFormat get format; String get label; String get filename; String get downloadPath;
/// Create a copy of AiChatAttachment
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$AiChatAttachmentCopyWith<AiChatAttachment> get copyWith => _$AiChatAttachmentCopyWithImpl<AiChatAttachment>(this as AiChatAttachment, _$identity);

  /// Serializes this AiChatAttachment to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is AiChatAttachment&&(identical(other.id, id) || other.id == id)&&(identical(other.kind, kind) || other.kind == kind)&&(identical(other.format, format) || other.format == format)&&(identical(other.label, label) || other.label == label)&&(identical(other.filename, filename) || other.filename == filename)&&(identical(other.downloadPath, downloadPath) || other.downloadPath == downloadPath));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,kind,format,label,filename,downloadPath);

@override
String toString() {
  return 'AiChatAttachment(id: $id, kind: $kind, format: $format, label: $label, filename: $filename, downloadPath: $downloadPath)';
}


}

/// @nodoc
abstract mixin class $AiChatAttachmentCopyWith<$Res>  {
  factory $AiChatAttachmentCopyWith(AiChatAttachment value, $Res Function(AiChatAttachment) _then) = _$AiChatAttachmentCopyWithImpl;
@useResult
$Res call({
 String id, AiAttachmentKind kind, AiAttachmentFormat format, String label, String filename, String downloadPath
});




}
/// @nodoc
class _$AiChatAttachmentCopyWithImpl<$Res>
    implements $AiChatAttachmentCopyWith<$Res> {
  _$AiChatAttachmentCopyWithImpl(this._self, this._then);

  final AiChatAttachment _self;
  final $Res Function(AiChatAttachment) _then;

/// Create a copy of AiChatAttachment
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? kind = null,Object? format = null,Object? label = null,Object? filename = null,Object? downloadPath = null,}) {
  return _then(AiChatAttachment(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,kind: null == kind ? _self.kind : kind // ignore: cast_nullable_to_non_nullable
as AiAttachmentKind,format: null == format ? _self.format : format // ignore: cast_nullable_to_non_nullable
as AiAttachmentFormat,label: null == label ? _self.label : label // ignore: cast_nullable_to_non_nullable
as String,filename: null == filename ? _self.filename : filename // ignore: cast_nullable_to_non_nullable
as String,downloadPath: null == downloadPath ? _self.downloadPath : downloadPath // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [AiChatAttachment].
extension AiChatAttachmentPatterns on AiChatAttachment {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _AiChatAttachment value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _AiChatAttachment() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _AiChatAttachment value)  $default,){
final _that = this;
switch (_that) {
case _AiChatAttachment():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _AiChatAttachment value)?  $default,){
final _that = this;
switch (_that) {
case _AiChatAttachment() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  AiAttachmentKind kind,  AiAttachmentFormat format,  String label,  String filename,  String downloadPath)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _AiChatAttachment() when $default != null:
return $default(_that.id,_that.kind,_that.format,_that.label,_that.filename,_that.downloadPath);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  AiAttachmentKind kind,  AiAttachmentFormat format,  String label,  String filename,  String downloadPath)  $default,) {final _that = this;
switch (_that) {
case _AiChatAttachment():
return $default(_that.id,_that.kind,_that.format,_that.label,_that.filename,_that.downloadPath);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  AiAttachmentKind kind,  AiAttachmentFormat format,  String label,  String filename,  String downloadPath)?  $default,) {final _that = this;
switch (_that) {
case _AiChatAttachment() when $default != null:
return $default(_that.id,_that.kind,_that.format,_that.label,_that.filename,_that.downloadPath);case _:
  return null;

}
}

}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true, converters: [AiAttachmentKindConverter(), AiAttachmentFormatConverter()])
class _AiChatAttachment implements AiChatAttachment {
  const _AiChatAttachment({required this.id, required this.kind, required this.format, this.label = '', this.filename = '', this.downloadPath = ''});
  factory _AiChatAttachment.fromJson(Map<String, dynamic> json) => _$AiChatAttachmentFromJson(json);

@override final  String id;
@override final  AiAttachmentKind kind;
@override final  AiAttachmentFormat format;
@override@JsonKey() final  String label;
@override@JsonKey() final  String filename;
@override@JsonKey() final  String downloadPath;

/// Create a copy of AiChatAttachment
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$AiChatAttachmentCopyWith<_AiChatAttachment> get copyWith => __$AiChatAttachmentCopyWithImpl<_AiChatAttachment>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$AiChatAttachmentToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _AiChatAttachment&&(identical(other.id, id) || other.id == id)&&(identical(other.kind, kind) || other.kind == kind)&&(identical(other.format, format) || other.format == format)&&(identical(other.label, label) || other.label == label)&&(identical(other.filename, filename) || other.filename == filename)&&(identical(other.downloadPath, downloadPath) || other.downloadPath == downloadPath));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,kind,format,label,filename,downloadPath);

@override
String toString() {
  return 'AiChatAttachment(id: $id, kind: $kind, format: $format, label: $label, filename: $filename, downloadPath: $downloadPath)';
}


}

/// @nodoc
abstract mixin class _$AiChatAttachmentCopyWith<$Res> implements $AiChatAttachmentCopyWith<$Res> {
  factory _$AiChatAttachmentCopyWith(_AiChatAttachment value, $Res Function(_AiChatAttachment) _then) = __$AiChatAttachmentCopyWithImpl;
@override @useResult
$Res call({
 String id, AiAttachmentKind kind, AiAttachmentFormat format, String label, String filename, String downloadPath
});




}
/// @nodoc
class __$AiChatAttachmentCopyWithImpl<$Res>
    implements _$AiChatAttachmentCopyWith<$Res> {
  __$AiChatAttachmentCopyWithImpl(this._self, this._then);

  final _AiChatAttachment _self;
  final $Res Function(_AiChatAttachment) _then;

/// Create a copy of AiChatAttachment
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? kind = null,Object? format = null,Object? label = null,Object? filename = null,Object? downloadPath = null,}) {
  return _then(_AiChatAttachment(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,kind: null == kind ? _self.kind : kind // ignore: cast_nullable_to_non_nullable
as AiAttachmentKind,format: null == format ? _self.format : format // ignore: cast_nullable_to_non_nullable
as AiAttachmentFormat,label: null == label ? _self.label : label // ignore: cast_nullable_to_non_nullable
as String,filename: null == filename ? _self.filename : filename // ignore: cast_nullable_to_non_nullable
as String,downloadPath: null == downloadPath ? _self.downloadPath : downloadPath // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}


/// @nodoc
mixin _$AiToolInvocationSummary {

 String get tool; AiToolOutcome get outcome; String? get detail;
/// Create a copy of AiToolInvocationSummary
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$AiToolInvocationSummaryCopyWith<AiToolInvocationSummary> get copyWith => _$AiToolInvocationSummaryCopyWithImpl<AiToolInvocationSummary>(this as AiToolInvocationSummary, _$identity);

  /// Serializes this AiToolInvocationSummary to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is AiToolInvocationSummary&&(identical(other.tool, tool) || other.tool == tool)&&(identical(other.outcome, outcome) || other.outcome == outcome)&&(identical(other.detail, detail) || other.detail == detail));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,tool,outcome,detail);

@override
String toString() {
  return 'AiToolInvocationSummary(tool: $tool, outcome: $outcome, detail: $detail)';
}


}

/// @nodoc
abstract mixin class $AiToolInvocationSummaryCopyWith<$Res>  {
  factory $AiToolInvocationSummaryCopyWith(AiToolInvocationSummary value, $Res Function(AiToolInvocationSummary) _then) = _$AiToolInvocationSummaryCopyWithImpl;
@useResult
$Res call({
 String tool, AiToolOutcome outcome, String? detail
});




}
/// @nodoc
class _$AiToolInvocationSummaryCopyWithImpl<$Res>
    implements $AiToolInvocationSummaryCopyWith<$Res> {
  _$AiToolInvocationSummaryCopyWithImpl(this._self, this._then);

  final AiToolInvocationSummary _self;
  final $Res Function(AiToolInvocationSummary) _then;

/// Create a copy of AiToolInvocationSummary
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? tool = null,Object? outcome = null,Object? detail = freezed,}) {
  return _then(AiToolInvocationSummary(
tool: null == tool ? _self.tool : tool // ignore: cast_nullable_to_non_nullable
as String,outcome: null == outcome ? _self.outcome : outcome // ignore: cast_nullable_to_non_nullable
as AiToolOutcome,detail: freezed == detail ? _self.detail : detail // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [AiToolInvocationSummary].
extension AiToolInvocationSummaryPatterns on AiToolInvocationSummary {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _AiToolInvocationSummary value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _AiToolInvocationSummary() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _AiToolInvocationSummary value)  $default,){
final _that = this;
switch (_that) {
case _AiToolInvocationSummary():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _AiToolInvocationSummary value)?  $default,){
final _that = this;
switch (_that) {
case _AiToolInvocationSummary() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String tool,  AiToolOutcome outcome,  String? detail)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _AiToolInvocationSummary() when $default != null:
return $default(_that.tool,_that.outcome,_that.detail);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String tool,  AiToolOutcome outcome,  String? detail)  $default,) {final _that = this;
switch (_that) {
case _AiToolInvocationSummary():
return $default(_that.tool,_that.outcome,_that.detail);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String tool,  AiToolOutcome outcome,  String? detail)?  $default,) {final _that = this;
switch (_that) {
case _AiToolInvocationSummary() when $default != null:
return $default(_that.tool,_that.outcome,_that.detail);case _:
  return null;

}
}

}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true, converters: [AiToolOutcomeConverter()])
class _AiToolInvocationSummary implements AiToolInvocationSummary {
  const _AiToolInvocationSummary({required this.tool, required this.outcome, this.detail});
  factory _AiToolInvocationSummary.fromJson(Map<String, dynamic> json) => _$AiToolInvocationSummaryFromJson(json);

@override final  String tool;
@override final  AiToolOutcome outcome;
@override final  String? detail;

/// Create a copy of AiToolInvocationSummary
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$AiToolInvocationSummaryCopyWith<_AiToolInvocationSummary> get copyWith => __$AiToolInvocationSummaryCopyWithImpl<_AiToolInvocationSummary>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$AiToolInvocationSummaryToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _AiToolInvocationSummary&&(identical(other.tool, tool) || other.tool == tool)&&(identical(other.outcome, outcome) || other.outcome == outcome)&&(identical(other.detail, detail) || other.detail == detail));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,tool,outcome,detail);

@override
String toString() {
  return 'AiToolInvocationSummary(tool: $tool, outcome: $outcome, detail: $detail)';
}


}

/// @nodoc
abstract mixin class _$AiToolInvocationSummaryCopyWith<$Res> implements $AiToolInvocationSummaryCopyWith<$Res> {
  factory _$AiToolInvocationSummaryCopyWith(_AiToolInvocationSummary value, $Res Function(_AiToolInvocationSummary) _then) = __$AiToolInvocationSummaryCopyWithImpl;
@override @useResult
$Res call({
 String tool, AiToolOutcome outcome, String? detail
});




}
/// @nodoc
class __$AiToolInvocationSummaryCopyWithImpl<$Res>
    implements _$AiToolInvocationSummaryCopyWith<$Res> {
  __$AiToolInvocationSummaryCopyWithImpl(this._self, this._then);

  final _AiToolInvocationSummary _self;
  final $Res Function(_AiToolInvocationSummary) _then;

/// Create a copy of AiToolInvocationSummary
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? tool = null,Object? outcome = null,Object? detail = freezed,}) {
  return _then(_AiToolInvocationSummary(
tool: null == tool ? _self.tool : tool // ignore: cast_nullable_to_non_nullable
as String,outcome: null == outcome ? _self.outcome : outcome // ignore: cast_nullable_to_non_nullable
as AiToolOutcome,detail: freezed == detail ? _self.detail : detail // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}


/// @nodoc
mixin _$AiChatMessage {

 String get id; String get threadId; AiChatRole get role; String get content; String get createdAt; List<AiChatAttachment> get attachments; List<AiToolInvocationSummary> get toolInvocations;
/// Create a copy of AiChatMessage
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$AiChatMessageCopyWith<AiChatMessage> get copyWith => _$AiChatMessageCopyWithImpl<AiChatMessage>(this as AiChatMessage, _$identity);

  /// Serializes this AiChatMessage to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is AiChatMessage&&(identical(other.id, id) || other.id == id)&&(identical(other.threadId, threadId) || other.threadId == threadId)&&(identical(other.role, role) || other.role == role)&&(identical(other.content, content) || other.content == content)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt)&&const DeepCollectionEquality().equals(other.attachments, attachments)&&const DeepCollectionEquality().equals(other.toolInvocations, toolInvocations));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,threadId,role,content,createdAt,const DeepCollectionEquality().hash(attachments),const DeepCollectionEquality().hash(toolInvocations));

@override
String toString() {
  return 'AiChatMessage(id: $id, threadId: $threadId, role: $role, content: $content, createdAt: $createdAt, attachments: $attachments, toolInvocations: $toolInvocations)';
}


}

/// @nodoc
abstract mixin class $AiChatMessageCopyWith<$Res>  {
  factory $AiChatMessageCopyWith(AiChatMessage value, $Res Function(AiChatMessage) _then) = _$AiChatMessageCopyWithImpl;
@useResult
$Res call({
 String id, String threadId, AiChatRole role, String content, String createdAt, List<AiChatAttachment> attachments, List<AiToolInvocationSummary> toolInvocations
});




}
/// @nodoc
class _$AiChatMessageCopyWithImpl<$Res>
    implements $AiChatMessageCopyWith<$Res> {
  _$AiChatMessageCopyWithImpl(this._self, this._then);

  final AiChatMessage _self;
  final $Res Function(AiChatMessage) _then;

/// Create a copy of AiChatMessage
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? threadId = null,Object? role = null,Object? content = null,Object? createdAt = null,Object? attachments = null,Object? toolInvocations = null,}) {
  return _then(AiChatMessage(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,threadId: null == threadId ? _self.threadId : threadId // ignore: cast_nullable_to_non_nullable
as String,role: null == role ? _self.role : role // ignore: cast_nullable_to_non_nullable
as AiChatRole,content: null == content ? _self.content : content // ignore: cast_nullable_to_non_nullable
as String,createdAt: null == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as String,attachments: null == attachments ? _self.attachments : attachments // ignore: cast_nullable_to_non_nullable
as List<AiChatAttachment>,toolInvocations: null == toolInvocations ? _self.toolInvocations : toolInvocations // ignore: cast_nullable_to_non_nullable
as List<AiToolInvocationSummary>,
  ));
}

}


/// Adds pattern-matching-related methods to [AiChatMessage].
extension AiChatMessagePatterns on AiChatMessage {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _AiChatMessage value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _AiChatMessage() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _AiChatMessage value)  $default,){
final _that = this;
switch (_that) {
case _AiChatMessage():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _AiChatMessage value)?  $default,){
final _that = this;
switch (_that) {
case _AiChatMessage() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String threadId,  AiChatRole role,  String content,  String createdAt,  List<AiChatAttachment> attachments,  List<AiToolInvocationSummary> toolInvocations)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _AiChatMessage() when $default != null:
return $default(_that.id,_that.threadId,_that.role,_that.content,_that.createdAt,_that.attachments,_that.toolInvocations);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String threadId,  AiChatRole role,  String content,  String createdAt,  List<AiChatAttachment> attachments,  List<AiToolInvocationSummary> toolInvocations)  $default,) {final _that = this;
switch (_that) {
case _AiChatMessage():
return $default(_that.id,_that.threadId,_that.role,_that.content,_that.createdAt,_that.attachments,_that.toolInvocations);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String threadId,  AiChatRole role,  String content,  String createdAt,  List<AiChatAttachment> attachments,  List<AiToolInvocationSummary> toolInvocations)?  $default,) {final _that = this;
switch (_that) {
case _AiChatMessage() when $default != null:
return $default(_that.id,_that.threadId,_that.role,_that.content,_that.createdAt,_that.attachments,_that.toolInvocations);case _:
  return null;

}
}

}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true, converters: [AiChatRoleConverter()])
class _AiChatMessage implements AiChatMessage {
  const _AiChatMessage({required this.id, required this.threadId, required this.role, this.content = '', this.createdAt = '',  List<AiChatAttachment> attachments = const <AiChatAttachment>[],  List<AiToolInvocationSummary> toolInvocations = const <AiToolInvocationSummary>[]}): _attachments = attachments,_toolInvocations = toolInvocations;
  factory _AiChatMessage.fromJson(Map<String, dynamic> json) => _$AiChatMessageFromJson(json);

@override final  String id;
@override final  String threadId;
@override final  AiChatRole role;
@override@JsonKey() final  String content;
@override@JsonKey() final  String createdAt;
 final  List<AiChatAttachment> _attachments;
@override@JsonKey() List<AiChatAttachment> get attachments {
  if (_attachments is EqualUnmodifiableListView) return _attachments;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_attachments);
}

 final  List<AiToolInvocationSummary> _toolInvocations;
@override@JsonKey() List<AiToolInvocationSummary> get toolInvocations {
  if (_toolInvocations is EqualUnmodifiableListView) return _toolInvocations;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_toolInvocations);
}


/// Create a copy of AiChatMessage
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$AiChatMessageCopyWith<_AiChatMessage> get copyWith => __$AiChatMessageCopyWithImpl<_AiChatMessage>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$AiChatMessageToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _AiChatMessage&&(identical(other.id, id) || other.id == id)&&(identical(other.threadId, threadId) || other.threadId == threadId)&&(identical(other.role, role) || other.role == role)&&(identical(other.content, content) || other.content == content)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt)&&const DeepCollectionEquality().equals(other._attachments, _attachments)&&const DeepCollectionEquality().equals(other._toolInvocations, _toolInvocations));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,threadId,role,content,createdAt,const DeepCollectionEquality().hash(_attachments),const DeepCollectionEquality().hash(_toolInvocations));

@override
String toString() {
  return 'AiChatMessage(id: $id, threadId: $threadId, role: $role, content: $content, createdAt: $createdAt, attachments: $attachments, toolInvocations: $toolInvocations)';
}


}

/// @nodoc
abstract mixin class _$AiChatMessageCopyWith<$Res> implements $AiChatMessageCopyWith<$Res> {
  factory _$AiChatMessageCopyWith(_AiChatMessage value, $Res Function(_AiChatMessage) _then) = __$AiChatMessageCopyWithImpl;
@override @useResult
$Res call({
 String id, String threadId, AiChatRole role, String content, String createdAt, List<AiChatAttachment> attachments, List<AiToolInvocationSummary> toolInvocations
});




}
/// @nodoc
class __$AiChatMessageCopyWithImpl<$Res>
    implements _$AiChatMessageCopyWith<$Res> {
  __$AiChatMessageCopyWithImpl(this._self, this._then);

  final _AiChatMessage _self;
  final $Res Function(_AiChatMessage) _then;

/// Create a copy of AiChatMessage
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? threadId = null,Object? role = null,Object? content = null,Object? createdAt = null,Object? attachments = null,Object? toolInvocations = null,}) {
  return _then(_AiChatMessage(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,threadId: null == threadId ? _self.threadId : threadId // ignore: cast_nullable_to_non_nullable
as String,role: null == role ? _self.role : role // ignore: cast_nullable_to_non_nullable
as AiChatRole,content: null == content ? _self.content : content // ignore: cast_nullable_to_non_nullable
as String,createdAt: null == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as String,attachments: null == attachments ? _self._attachments : attachments // ignore: cast_nullable_to_non_nullable
as List<AiChatAttachment>,toolInvocations: null == toolInvocations ? _self._toolInvocations : toolInvocations // ignore: cast_nullable_to_non_nullable
as List<AiToolInvocationSummary>,
  ));
}


}


/// @nodoc
mixin _$AiChatThread {

 String get id; List<AiChatMessage> get messages; String get createdAt; String get updatedAt;
/// Create a copy of AiChatThread
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$AiChatThreadCopyWith<AiChatThread> get copyWith => _$AiChatThreadCopyWithImpl<AiChatThread>(this as AiChatThread, _$identity);

  /// Serializes this AiChatThread to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is AiChatThread&&(identical(other.id, id) || other.id == id)&&const DeepCollectionEquality().equals(other.messages, messages)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt)&&(identical(other.updatedAt, updatedAt) || other.updatedAt == updatedAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,const DeepCollectionEquality().hash(messages),createdAt,updatedAt);

@override
String toString() {
  return 'AiChatThread(id: $id, messages: $messages, createdAt: $createdAt, updatedAt: $updatedAt)';
}


}

/// @nodoc
abstract mixin class $AiChatThreadCopyWith<$Res>  {
  factory $AiChatThreadCopyWith(AiChatThread value, $Res Function(AiChatThread) _then) = _$AiChatThreadCopyWithImpl;
@useResult
$Res call({
 String id, List<AiChatMessage> messages, String createdAt, String updatedAt
});




}
/// @nodoc
class _$AiChatThreadCopyWithImpl<$Res>
    implements $AiChatThreadCopyWith<$Res> {
  _$AiChatThreadCopyWithImpl(this._self, this._then);

  final AiChatThread _self;
  final $Res Function(AiChatThread) _then;

/// Create a copy of AiChatThread
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? messages = null,Object? createdAt = null,Object? updatedAt = null,}) {
  return _then(AiChatThread(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,messages: null == messages ? _self.messages : messages // ignore: cast_nullable_to_non_nullable
as List<AiChatMessage>,createdAt: null == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as String,updatedAt: null == updatedAt ? _self.updatedAt : updatedAt // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [AiChatThread].
extension AiChatThreadPatterns on AiChatThread {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _AiChatThread value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _AiChatThread() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _AiChatThread value)  $default,){
final _that = this;
switch (_that) {
case _AiChatThread():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _AiChatThread value)?  $default,){
final _that = this;
switch (_that) {
case _AiChatThread() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  List<AiChatMessage> messages,  String createdAt,  String updatedAt)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _AiChatThread() when $default != null:
return $default(_that.id,_that.messages,_that.createdAt,_that.updatedAt);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  List<AiChatMessage> messages,  String createdAt,  String updatedAt)  $default,) {final _that = this;
switch (_that) {
case _AiChatThread():
return $default(_that.id,_that.messages,_that.createdAt,_that.updatedAt);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  List<AiChatMessage> messages,  String createdAt,  String updatedAt)?  $default,) {final _that = this;
switch (_that) {
case _AiChatThread() when $default != null:
return $default(_that.id,_that.messages,_that.createdAt,_that.updatedAt);case _:
  return null;

}
}

}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
class _AiChatThread implements AiChatThread {
  const _AiChatThread({required this.id,  List<AiChatMessage> messages = const <AiChatMessage>[], this.createdAt = '', this.updatedAt = ''}): _messages = messages;
  factory _AiChatThread.fromJson(Map<String, dynamic> json) => _$AiChatThreadFromJson(json);

@override final  String id;
 final  List<AiChatMessage> _messages;
@override@JsonKey() List<AiChatMessage> get messages {
  if (_messages is EqualUnmodifiableListView) return _messages;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_messages);
}

@override@JsonKey() final  String createdAt;
@override@JsonKey() final  String updatedAt;

/// Create a copy of AiChatThread
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$AiChatThreadCopyWith<_AiChatThread> get copyWith => __$AiChatThreadCopyWithImpl<_AiChatThread>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$AiChatThreadToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _AiChatThread&&(identical(other.id, id) || other.id == id)&&const DeepCollectionEquality().equals(other._messages, _messages)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt)&&(identical(other.updatedAt, updatedAt) || other.updatedAt == updatedAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,const DeepCollectionEquality().hash(_messages),createdAt,updatedAt);

@override
String toString() {
  return 'AiChatThread(id: $id, messages: $messages, createdAt: $createdAt, updatedAt: $updatedAt)';
}


}

/// @nodoc
abstract mixin class _$AiChatThreadCopyWith<$Res> implements $AiChatThreadCopyWith<$Res> {
  factory _$AiChatThreadCopyWith(_AiChatThread value, $Res Function(_AiChatThread) _then) = __$AiChatThreadCopyWithImpl;
@override @useResult
$Res call({
 String id, List<AiChatMessage> messages, String createdAt, String updatedAt
});




}
/// @nodoc
class __$AiChatThreadCopyWithImpl<$Res>
    implements _$AiChatThreadCopyWith<$Res> {
  __$AiChatThreadCopyWithImpl(this._self, this._then);

  final _AiChatThread _self;
  final $Res Function(_AiChatThread) _then;

/// Create a copy of AiChatThread
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? messages = null,Object? createdAt = null,Object? updatedAt = null,}) {
  return _then(_AiChatThread(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,messages: null == messages ? _self._messages : messages // ignore: cast_nullable_to_non_nullable
as List<AiChatMessage>,createdAt: null == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as String,updatedAt: null == updatedAt ? _self.updatedAt : updatedAt // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}


/// @nodoc
mixin _$AiChatSendInput {

 String get message; String? get threadId; bool? get regenerate;
/// Create a copy of AiChatSendInput
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$AiChatSendInputCopyWith<AiChatSendInput> get copyWith => _$AiChatSendInputCopyWithImpl<AiChatSendInput>(this as AiChatSendInput, _$identity);

  /// Serializes this AiChatSendInput to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is AiChatSendInput&&(identical(other.message, message) || other.message == message)&&(identical(other.threadId, threadId) || other.threadId == threadId)&&(identical(other.regenerate, regenerate) || other.regenerate == regenerate));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,message,threadId,regenerate);

@override
String toString() {
  return 'AiChatSendInput(message: $message, threadId: $threadId, regenerate: $regenerate)';
}


}

/// @nodoc
abstract mixin class $AiChatSendInputCopyWith<$Res>  {
  factory $AiChatSendInputCopyWith(AiChatSendInput value, $Res Function(AiChatSendInput) _then) = _$AiChatSendInputCopyWithImpl;
@useResult
$Res call({
 String message, String? threadId, bool? regenerate
});




}
/// @nodoc
class _$AiChatSendInputCopyWithImpl<$Res>
    implements $AiChatSendInputCopyWith<$Res> {
  _$AiChatSendInputCopyWithImpl(this._self, this._then);

  final AiChatSendInput _self;
  final $Res Function(AiChatSendInput) _then;

/// Create a copy of AiChatSendInput
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? message = null,Object? threadId = freezed,Object? regenerate = freezed,}) {
  return _then(AiChatSendInput(
message: null == message ? _self.message : message // ignore: cast_nullable_to_non_nullable
as String,threadId: freezed == threadId ? _self.threadId : threadId // ignore: cast_nullable_to_non_nullable
as String?,regenerate: freezed == regenerate ? _self.regenerate : regenerate // ignore: cast_nullable_to_non_nullable
as bool?,
  ));
}

}


/// Adds pattern-matching-related methods to [AiChatSendInput].
extension AiChatSendInputPatterns on AiChatSendInput {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _AiChatSendInput value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _AiChatSendInput() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _AiChatSendInput value)  $default,){
final _that = this;
switch (_that) {
case _AiChatSendInput():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _AiChatSendInput value)?  $default,){
final _that = this;
switch (_that) {
case _AiChatSendInput() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String message,  String? threadId,  bool? regenerate)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _AiChatSendInput() when $default != null:
return $default(_that.message,_that.threadId,_that.regenerate);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String message,  String? threadId,  bool? regenerate)  $default,) {final _that = this;
switch (_that) {
case _AiChatSendInput():
return $default(_that.message,_that.threadId,_that.regenerate);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String message,  String? threadId,  bool? regenerate)?  $default,) {final _that = this;
switch (_that) {
case _AiChatSendInput() when $default != null:
return $default(_that.message,_that.threadId,_that.regenerate);case _:
  return null;

}
}

}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
class _AiChatSendInput implements AiChatSendInput {
  const _AiChatSendInput({required this.message, this.threadId, this.regenerate});
  factory _AiChatSendInput.fromJson(Map<String, dynamic> json) => _$AiChatSendInputFromJson(json);

@override final  String message;
@override final  String? threadId;
@override final  bool? regenerate;

/// Create a copy of AiChatSendInput
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$AiChatSendInputCopyWith<_AiChatSendInput> get copyWith => __$AiChatSendInputCopyWithImpl<_AiChatSendInput>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$AiChatSendInputToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _AiChatSendInput&&(identical(other.message, message) || other.message == message)&&(identical(other.threadId, threadId) || other.threadId == threadId)&&(identical(other.regenerate, regenerate) || other.regenerate == regenerate));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,message,threadId,regenerate);

@override
String toString() {
  return 'AiChatSendInput(message: $message, threadId: $threadId, regenerate: $regenerate)';
}


}

/// @nodoc
abstract mixin class _$AiChatSendInputCopyWith<$Res> implements $AiChatSendInputCopyWith<$Res> {
  factory _$AiChatSendInputCopyWith(_AiChatSendInput value, $Res Function(_AiChatSendInput) _then) = __$AiChatSendInputCopyWithImpl;
@override @useResult
$Res call({
 String message, String? threadId, bool? regenerate
});




}
/// @nodoc
class __$AiChatSendInputCopyWithImpl<$Res>
    implements _$AiChatSendInputCopyWith<$Res> {
  __$AiChatSendInputCopyWithImpl(this._self, this._then);

  final _AiChatSendInput _self;
  final $Res Function(_AiChatSendInput) _then;

/// Create a copy of AiChatSendInput
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? message = null,Object? threadId = freezed,Object? regenerate = freezed,}) {
  return _then(_AiChatSendInput(
message: null == message ? _self.message : message // ignore: cast_nullable_to_non_nullable
as String,threadId: freezed == threadId ? _self.threadId : threadId // ignore: cast_nullable_to_non_nullable
as String?,regenerate: freezed == regenerate ? _self.regenerate : regenerate // ignore: cast_nullable_to_non_nullable
as bool?,
  ));
}


}


/// @nodoc
mixin _$AiChatSendResult {

 String get threadId; String get messageId;
/// Create a copy of AiChatSendResult
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$AiChatSendResultCopyWith<AiChatSendResult> get copyWith => _$AiChatSendResultCopyWithImpl<AiChatSendResult>(this as AiChatSendResult, _$identity);

  /// Serializes this AiChatSendResult to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is AiChatSendResult&&(identical(other.threadId, threadId) || other.threadId == threadId)&&(identical(other.messageId, messageId) || other.messageId == messageId));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,threadId,messageId);

@override
String toString() {
  return 'AiChatSendResult(threadId: $threadId, messageId: $messageId)';
}


}

/// @nodoc
abstract mixin class $AiChatSendResultCopyWith<$Res>  {
  factory $AiChatSendResultCopyWith(AiChatSendResult value, $Res Function(AiChatSendResult) _then) = _$AiChatSendResultCopyWithImpl;
@useResult
$Res call({
 String threadId, String messageId
});




}
/// @nodoc
class _$AiChatSendResultCopyWithImpl<$Res>
    implements $AiChatSendResultCopyWith<$Res> {
  _$AiChatSendResultCopyWithImpl(this._self, this._then);

  final AiChatSendResult _self;
  final $Res Function(AiChatSendResult) _then;

/// Create a copy of AiChatSendResult
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? threadId = null,Object? messageId = null,}) {
  return _then(AiChatSendResult(
threadId: null == threadId ? _self.threadId : threadId // ignore: cast_nullable_to_non_nullable
as String,messageId: null == messageId ? _self.messageId : messageId // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [AiChatSendResult].
extension AiChatSendResultPatterns on AiChatSendResult {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _AiChatSendResult value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _AiChatSendResult() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _AiChatSendResult value)  $default,){
final _that = this;
switch (_that) {
case _AiChatSendResult():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _AiChatSendResult value)?  $default,){
final _that = this;
switch (_that) {
case _AiChatSendResult() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String threadId,  String messageId)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _AiChatSendResult() when $default != null:
return $default(_that.threadId,_that.messageId);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String threadId,  String messageId)  $default,) {final _that = this;
switch (_that) {
case _AiChatSendResult():
return $default(_that.threadId,_that.messageId);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String threadId,  String messageId)?  $default,) {final _that = this;
switch (_that) {
case _AiChatSendResult() when $default != null:
return $default(_that.threadId,_that.messageId);case _:
  return null;

}
}

}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
class _AiChatSendResult implements AiChatSendResult {
  const _AiChatSendResult({required this.threadId, required this.messageId});
  factory _AiChatSendResult.fromJson(Map<String, dynamic> json) => _$AiChatSendResultFromJson(json);

@override final  String threadId;
@override final  String messageId;

/// Create a copy of AiChatSendResult
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$AiChatSendResultCopyWith<_AiChatSendResult> get copyWith => __$AiChatSendResultCopyWithImpl<_AiChatSendResult>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$AiChatSendResultToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _AiChatSendResult&&(identical(other.threadId, threadId) || other.threadId == threadId)&&(identical(other.messageId, messageId) || other.messageId == messageId));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,threadId,messageId);

@override
String toString() {
  return 'AiChatSendResult(threadId: $threadId, messageId: $messageId)';
}


}

/// @nodoc
abstract mixin class _$AiChatSendResultCopyWith<$Res> implements $AiChatSendResultCopyWith<$Res> {
  factory _$AiChatSendResultCopyWith(_AiChatSendResult value, $Res Function(_AiChatSendResult) _then) = __$AiChatSendResultCopyWithImpl;
@override @useResult
$Res call({
 String threadId, String messageId
});




}
/// @nodoc
class __$AiChatSendResultCopyWithImpl<$Res>
    implements _$AiChatSendResultCopyWith<$Res> {
  __$AiChatSendResultCopyWithImpl(this._self, this._then);

  final _AiChatSendResult _self;
  final $Res Function(_AiChatSendResult) _then;

/// Create a copy of AiChatSendResult
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? threadId = null,Object? messageId = null,}) {
  return _then(_AiChatSendResult(
threadId: null == threadId ? _self.threadId : threadId // ignore: cast_nullable_to_non_nullable
as String,messageId: null == messageId ? _self.messageId : messageId // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}


/// @nodoc
mixin _$AiThreadSummary {

 String get id; String get title; String get createdAt; String get updatedAt;
/// Create a copy of AiThreadSummary
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$AiThreadSummaryCopyWith<AiThreadSummary> get copyWith => _$AiThreadSummaryCopyWithImpl<AiThreadSummary>(this as AiThreadSummary, _$identity);

  /// Serializes this AiThreadSummary to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is AiThreadSummary&&(identical(other.id, id) || other.id == id)&&(identical(other.title, title) || other.title == title)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt)&&(identical(other.updatedAt, updatedAt) || other.updatedAt == updatedAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,title,createdAt,updatedAt);

@override
String toString() {
  return 'AiThreadSummary(id: $id, title: $title, createdAt: $createdAt, updatedAt: $updatedAt)';
}


}

/// @nodoc
abstract mixin class $AiThreadSummaryCopyWith<$Res>  {
  factory $AiThreadSummaryCopyWith(AiThreadSummary value, $Res Function(AiThreadSummary) _then) = _$AiThreadSummaryCopyWithImpl;
@useResult
$Res call({
 String id, String title, String createdAt, String updatedAt
});




}
/// @nodoc
class _$AiThreadSummaryCopyWithImpl<$Res>
    implements $AiThreadSummaryCopyWith<$Res> {
  _$AiThreadSummaryCopyWithImpl(this._self, this._then);

  final AiThreadSummary _self;
  final $Res Function(AiThreadSummary) _then;

/// Create a copy of AiThreadSummary
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? title = null,Object? createdAt = null,Object? updatedAt = null,}) {
  return _then(AiThreadSummary(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,title: null == title ? _self.title : title // ignore: cast_nullable_to_non_nullable
as String,createdAt: null == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as String,updatedAt: null == updatedAt ? _self.updatedAt : updatedAt // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [AiThreadSummary].
extension AiThreadSummaryPatterns on AiThreadSummary {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _AiThreadSummary value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _AiThreadSummary() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _AiThreadSummary value)  $default,){
final _that = this;
switch (_that) {
case _AiThreadSummary():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _AiThreadSummary value)?  $default,){
final _that = this;
switch (_that) {
case _AiThreadSummary() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String title,  String createdAt,  String updatedAt)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _AiThreadSummary() when $default != null:
return $default(_that.id,_that.title,_that.createdAt,_that.updatedAt);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String title,  String createdAt,  String updatedAt)  $default,) {final _that = this;
switch (_that) {
case _AiThreadSummary():
return $default(_that.id,_that.title,_that.createdAt,_that.updatedAt);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String title,  String createdAt,  String updatedAt)?  $default,) {final _that = this;
switch (_that) {
case _AiThreadSummary() when $default != null:
return $default(_that.id,_that.title,_that.createdAt,_that.updatedAt);case _:
  return null;

}
}

}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
class _AiThreadSummary implements AiThreadSummary {
  const _AiThreadSummary({required this.id, this.title = '', this.createdAt = '', this.updatedAt = ''});
  factory _AiThreadSummary.fromJson(Map<String, dynamic> json) => _$AiThreadSummaryFromJson(json);

@override final  String id;
@override@JsonKey() final  String title;
@override@JsonKey() final  String createdAt;
@override@JsonKey() final  String updatedAt;

/// Create a copy of AiThreadSummary
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$AiThreadSummaryCopyWith<_AiThreadSummary> get copyWith => __$AiThreadSummaryCopyWithImpl<_AiThreadSummary>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$AiThreadSummaryToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _AiThreadSummary&&(identical(other.id, id) || other.id == id)&&(identical(other.title, title) || other.title == title)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt)&&(identical(other.updatedAt, updatedAt) || other.updatedAt == updatedAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,title,createdAt,updatedAt);

@override
String toString() {
  return 'AiThreadSummary(id: $id, title: $title, createdAt: $createdAt, updatedAt: $updatedAt)';
}


}

/// @nodoc
abstract mixin class _$AiThreadSummaryCopyWith<$Res> implements $AiThreadSummaryCopyWith<$Res> {
  factory _$AiThreadSummaryCopyWith(_AiThreadSummary value, $Res Function(_AiThreadSummary) _then) = __$AiThreadSummaryCopyWithImpl;
@override @useResult
$Res call({
 String id, String title, String createdAt, String updatedAt
});




}
/// @nodoc
class __$AiThreadSummaryCopyWithImpl<$Res>
    implements _$AiThreadSummaryCopyWith<$Res> {
  __$AiThreadSummaryCopyWithImpl(this._self, this._then);

  final _AiThreadSummary _self;
  final $Res Function(_AiThreadSummary) _then;

/// Create a copy of AiThreadSummary
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? title = null,Object? createdAt = null,Object? updatedAt = null,}) {
  return _then(_AiThreadSummary(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,title: null == title ? _self.title : title // ignore: cast_nullable_to_non_nullable
as String,createdAt: null == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as String,updatedAt: null == updatedAt ? _self.updatedAt : updatedAt // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}


/// @nodoc
mixin _$AiCapabilities {

 bool get enabled; String? get model; int? get maxMessageChars; String? get reason; List<AiMissingConfig> get missing; bool get policyBlocked;
/// Create a copy of AiCapabilities
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$AiCapabilitiesCopyWith<AiCapabilities> get copyWith => _$AiCapabilitiesCopyWithImpl<AiCapabilities>(this as AiCapabilities, _$identity);

  /// Serializes this AiCapabilities to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is AiCapabilities&&(identical(other.enabled, enabled) || other.enabled == enabled)&&(identical(other.model, model) || other.model == model)&&(identical(other.maxMessageChars, maxMessageChars) || other.maxMessageChars == maxMessageChars)&&(identical(other.reason, reason) || other.reason == reason)&&const DeepCollectionEquality().equals(other.missing, missing)&&(identical(other.policyBlocked, policyBlocked) || other.policyBlocked == policyBlocked));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,enabled,model,maxMessageChars,reason,const DeepCollectionEquality().hash(missing),policyBlocked);

@override
String toString() {
  return 'AiCapabilities(enabled: $enabled, model: $model, maxMessageChars: $maxMessageChars, reason: $reason, missing: $missing, policyBlocked: $policyBlocked)';
}


}

/// @nodoc
abstract mixin class $AiCapabilitiesCopyWith<$Res>  {
  factory $AiCapabilitiesCopyWith(AiCapabilities value, $Res Function(AiCapabilities) _then) = _$AiCapabilitiesCopyWithImpl;
@useResult
$Res call({
 bool enabled, String? model, int? maxMessageChars, String? reason, List<AiMissingConfig> missing, bool policyBlocked
});




}
/// @nodoc
class _$AiCapabilitiesCopyWithImpl<$Res>
    implements $AiCapabilitiesCopyWith<$Res> {
  _$AiCapabilitiesCopyWithImpl(this._self, this._then);

  final AiCapabilities _self;
  final $Res Function(AiCapabilities) _then;

/// Create a copy of AiCapabilities
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? enabled = null,Object? model = freezed,Object? maxMessageChars = freezed,Object? reason = freezed,Object? missing = null,Object? policyBlocked = null,}) {
  return _then(AiCapabilities(
enabled: null == enabled ? _self.enabled : enabled // ignore: cast_nullable_to_non_nullable
as bool,model: freezed == model ? _self.model : model // ignore: cast_nullable_to_non_nullable
as String?,maxMessageChars: freezed == maxMessageChars ? _self.maxMessageChars : maxMessageChars // ignore: cast_nullable_to_non_nullable
as int?,reason: freezed == reason ? _self.reason : reason // ignore: cast_nullable_to_non_nullable
as String?,missing: null == missing ? _self.missing : missing // ignore: cast_nullable_to_non_nullable
as List<AiMissingConfig>,policyBlocked: null == policyBlocked ? _self.policyBlocked : policyBlocked // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}

}


/// Adds pattern-matching-related methods to [AiCapabilities].
extension AiCapabilitiesPatterns on AiCapabilities {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _AiCapabilities value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _AiCapabilities() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _AiCapabilities value)  $default,){
final _that = this;
switch (_that) {
case _AiCapabilities():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _AiCapabilities value)?  $default,){
final _that = this;
switch (_that) {
case _AiCapabilities() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( bool enabled,  String? model,  int? maxMessageChars,  String? reason,  List<AiMissingConfig> missing,  bool policyBlocked)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _AiCapabilities() when $default != null:
return $default(_that.enabled,_that.model,_that.maxMessageChars,_that.reason,_that.missing,_that.policyBlocked);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( bool enabled,  String? model,  int? maxMessageChars,  String? reason,  List<AiMissingConfig> missing,  bool policyBlocked)  $default,) {final _that = this;
switch (_that) {
case _AiCapabilities():
return $default(_that.enabled,_that.model,_that.maxMessageChars,_that.reason,_that.missing,_that.policyBlocked);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( bool enabled,  String? model,  int? maxMessageChars,  String? reason,  List<AiMissingConfig> missing,  bool policyBlocked)?  $default,) {final _that = this;
switch (_that) {
case _AiCapabilities() when $default != null:
return $default(_that.enabled,_that.model,_that.maxMessageChars,_that.reason,_that.missing,_that.policyBlocked);case _:
  return null;

}
}

}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true, converters: [AiMissingConfigConverter()])
class _AiCapabilities implements AiCapabilities {
  const _AiCapabilities({required this.enabled, this.model, this.maxMessageChars, this.reason,  List<AiMissingConfig> missing = const <AiMissingConfig>[], this.policyBlocked = false}): _missing = missing;
  factory _AiCapabilities.fromJson(Map<String, dynamic> json) => _$AiCapabilitiesFromJson(json);

@override final  bool enabled;
@override final  String? model;
@override final  int? maxMessageChars;
@override final  String? reason;
 final  List<AiMissingConfig> _missing;
@override@JsonKey() List<AiMissingConfig> get missing {
  if (_missing is EqualUnmodifiableListView) return _missing;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_missing);
}

@override@JsonKey() final  bool policyBlocked;

/// Create a copy of AiCapabilities
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$AiCapabilitiesCopyWith<_AiCapabilities> get copyWith => __$AiCapabilitiesCopyWithImpl<_AiCapabilities>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$AiCapabilitiesToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _AiCapabilities&&(identical(other.enabled, enabled) || other.enabled == enabled)&&(identical(other.model, model) || other.model == model)&&(identical(other.maxMessageChars, maxMessageChars) || other.maxMessageChars == maxMessageChars)&&(identical(other.reason, reason) || other.reason == reason)&&const DeepCollectionEquality().equals(other._missing, _missing)&&(identical(other.policyBlocked, policyBlocked) || other.policyBlocked == policyBlocked));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,enabled,model,maxMessageChars,reason,const DeepCollectionEquality().hash(_missing),policyBlocked);

@override
String toString() {
  return 'AiCapabilities(enabled: $enabled, model: $model, maxMessageChars: $maxMessageChars, reason: $reason, missing: $missing, policyBlocked: $policyBlocked)';
}


}

/// @nodoc
abstract mixin class _$AiCapabilitiesCopyWith<$Res> implements $AiCapabilitiesCopyWith<$Res> {
  factory _$AiCapabilitiesCopyWith(_AiCapabilities value, $Res Function(_AiCapabilities) _then) = __$AiCapabilitiesCopyWithImpl;
@override @useResult
$Res call({
 bool enabled, String? model, int? maxMessageChars, String? reason, List<AiMissingConfig> missing, bool policyBlocked
});




}
/// @nodoc
class __$AiCapabilitiesCopyWithImpl<$Res>
    implements _$AiCapabilitiesCopyWith<$Res> {
  __$AiCapabilitiesCopyWithImpl(this._self, this._then);

  final _AiCapabilities _self;
  final $Res Function(_AiCapabilities) _then;

/// Create a copy of AiCapabilities
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? enabled = null,Object? model = freezed,Object? maxMessageChars = freezed,Object? reason = freezed,Object? missing = null,Object? policyBlocked = null,}) {
  return _then(_AiCapabilities(
enabled: null == enabled ? _self.enabled : enabled // ignore: cast_nullable_to_non_nullable
as bool,model: freezed == model ? _self.model : model // ignore: cast_nullable_to_non_nullable
as String?,maxMessageChars: freezed == maxMessageChars ? _self.maxMessageChars : maxMessageChars // ignore: cast_nullable_to_non_nullable
as int?,reason: freezed == reason ? _self.reason : reason // ignore: cast_nullable_to_non_nullable
as String?,missing: null == missing ? _self._missing : missing // ignore: cast_nullable_to_non_nullable
as List<AiMissingConfig>,policyBlocked: null == policyBlocked ? _self.policyBlocked : policyBlocked // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}


}

// dart format on

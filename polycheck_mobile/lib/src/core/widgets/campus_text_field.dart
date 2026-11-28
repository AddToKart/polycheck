import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../theme/brand_theme.dart';

/// Square label/error/helper text field with an obscure toggle.
///
/// The label sits above the field (dense mobile forms), while error and helper
/// text use the theme's input decoration slots.
class CampusTextField extends StatefulWidget {
  const CampusTextField({
    super.key,
    this.controller,
    this.label,
    this.hint,
    this.helperText,
    this.errorText,
    this.obscure = false,
    this.keyboardType,
    this.textInputAction,
    this.textCapitalization = TextCapitalization.none,
    this.onChanged,
    this.onSubmitted,
    this.enabled = true,
    this.maxLines = 1,
    this.minLines,
    this.prefixIcon,
    this.suffix,
    this.autofillHints,
    this.focusNode,
    this.readOnly = false,
    this.maxLength,
    this.inputFormatters,
  });

  final TextEditingController? controller;
  final String? label;
  final String? hint;
  final String? helperText;
  final String? errorText;

  /// When true the field starts obscured and shows a visibility toggle.
  final bool obscure;

  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final TextCapitalization textCapitalization;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;
  final bool enabled;
  final int maxLines;
  final int? minLines;
  final IconData? prefixIcon;
  final Widget? suffix;
  final Iterable<String>? autofillHints;
  final FocusNode? focusNode;
  final bool readOnly;

  /// Hard input cap (optional). Mirrors the backend `@MaxLength` so an
  /// over-length value can never be typed, let alone submitted.
  final int? maxLength;

  /// Keeps out characters the field can never accept.
  final List<TextInputFormatter>? inputFormatters;

  @override
  State<CampusTextField> createState() => _CampusTextFieldState();
}

class _CampusTextFieldState extends State<CampusTextField> {
  late bool _obscured = widget.obscure;

  @override
  void didUpdateWidget(CampusTextField oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.obscure != widget.obscure) {
      _obscured = widget.obscure;
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = BrandTheme.of(context);
    final label = widget.label;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (label != null && label.isNotEmpty) ...[
          Text(
            label,
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
              color: tokens.onSurface,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 6),
        ],
        TextField(
          controller: widget.controller,
          focusNode: widget.focusNode,
          enabled: widget.enabled,
          readOnly: widget.readOnly,
          obscureText: widget.obscure && _obscured,
          keyboardType: widget.keyboardType,
          textInputAction: widget.textInputAction,
          textCapitalization: widget.textCapitalization,
          onChanged: widget.onChanged,
          onSubmitted: widget.onSubmitted,
          maxLength: widget.maxLength,
          inputFormatters: widget.inputFormatters,
          // The cap is enforced silently; the field's helper/error slot already
          // carries the guidance, so the Flutter counter would only add height.
          buildCounter:
              (
                context, {
                required currentLength,
                required isFocused,
                required maxLength,
              }) => null,
          maxLines: widget.obscure ? 1 : widget.maxLines,
          minLines: widget.obscure ? null : widget.minLines,
          autofillHints: widget.autofillHints,
          style: Theme.of(
            context,
          ).textTheme.bodyMedium?.copyWith(color: tokens.onSurface),
          decoration: InputDecoration(
            hintText: widget.hint,
            helperText: widget.helperText,
            helperMaxLines: 3,
            errorText: widget.errorText,
            errorMaxLines: 3,
            prefixIcon: widget.prefixIcon == null
                ? null
                : Icon(widget.prefixIcon, size: 20),
            suffixIcon: widget.obscure
                ? IconButton(
                    tooltip: _obscured ? 'Show value' : 'Hide value',
                    onPressed: () => setState(() => _obscured = !_obscured),
                    icon: Icon(
                      _obscured
                          ? Icons.visibility_outlined
                          : Icons.visibility_off_outlined,
                      size: 20,
                    ),
                  )
                : widget.suffix,
          ),
        ),
      ],
    );
  }
}

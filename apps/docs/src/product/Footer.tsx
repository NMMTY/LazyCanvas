import { layout, social } from "@/resources/once-ui.config";
import {
  Button,
  Column,
  Icon,
  Logo,
  Row,
  SmartLink,
  ThemeSwitcher,
} from "@once-ui-system/core";

export const Footer = () => {
  return (
    <Column gap="40" fillWidth paddingY="xl" paddingX="l" horizontal="center" position="relative">
      <Row maxWidth={layout.footer.width} horizontal="between" gap="40" wrap paddingX="2">
        <Column gap="12" textVariant="label-default-m">
          <Row paddingX="2" marginBottom="8">
            Based On
          </Row>
          <Row>
            <SmartLink href="https://once-ui.com/products/magic-docs">Magic Docs</SmartLink>
          </Row>
        </Column>
        <Column data-border="rounded" gap="12" textVariant="label-default-m">
          <Row paddingX="2" marginBottom="8">
            Social
          </Row>
          {social.map((link, index) => (
            <Button key={index} href={link.link} weight="default" prefixIcon={link.icon} label={link.name} size="s" variant="secondary" />
          ))}
        </Column>
      </Row>
      <Row maxWidth={layout.footer.width}>
        <ThemeSwitcher />
      </Row>
    </Column>
  );
};

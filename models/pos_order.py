from odoo import api, models, _
import base64
import logging


class PosOrder(models.Model):
    _inherit = 'pos.order'

    def action_invoice_to_customer(self, name=None, client=None):
        self.ensure_one()

        report = self.env.ref('customize_point_sale.pos_invoice_report_imagen').render_qweb_pdf(self.account_move.id)
        filename = self.name + '.pdf'
        attachment = self.env['ir.attachment'].create({
            'name': filename,
            'type': 'binary',
            'datas': base64.b64encode(report[0]),
            'store_fname': filename,
            'res_model': 'pos.order',
            'res_id': self.id,
            'mimetype': 'application/x-pdf'
        })

        base_url = self.env['ir.config_parameter'].get_param('web.base.url')
        download_url = '/web/content/' + str(attachment.id) + '?download=true'

        return {
            'name': 'Report',
            'type': 'ir.actions.act_url',
            "url": str(base_url) + str(download_url),
            'target': 'new',
        }

    @api.model
    def action_receipt_to_customer_override(self, name, client, ticket, order_ids=False):
        logging.warning('Overrid action_receipt_to_customer')

        # FIXME MASTER: make a true multi
        if not self.env.user.has_group('point_of_sale.group_pos_user'):
            return False
        if not client.get('email'):
            return False
        orders = self.browse(order_ids) if order_ids else self

        message = _("<p>Dear %s,<br/>Here is your electronic ticket for the %s. </p>") % (client['name'], name)

        filename = 'Receipt-' + name + '.jpg'
        receipt = self.env['ir.attachment'].create({
            'name': filename,
            'type': 'binary',
            'datas': ticket,
            'res_model': 'pos.order',
            'res_id': orders[:1].id,
            'store_fname': filename,
            'mimetype': 'image/jpeg',
        })
        template_data = {
            'subject': _('Receipt %s') % name,
            'body_html': message,
            'author_id': self.env.user.partner_id.id,
            'email_from': self.env.company.email or self.env.user.email_formatted,
            'email_to': client['email'],
            'attachment_ids': [(4, receipt.id)],
        }

        if orders.mapped('account_move'):
            report = self.env.ref('customize_point_sale.report_invoice_imagen_pdv').render_qweb_pdf(orders.ids[0])
            filename = name + '.pdf'
            attachment = self.env['ir.attachment'].create({
                'name': filename,
                'type': 'binary',
                'datas': base64.b64encode(report[0]),
                'store_fname': filename,
                'res_model': 'pos.order',
                'res_id': orders[:1].id,
                'mimetype': 'application/x-pdf'
            })
            template_data['attachment_ids'] += [(4, attachment.id)]

        mail = self.env['mail.mail'].create(template_data)
        mail.send()
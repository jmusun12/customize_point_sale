from odoo import api, models
import base64


class PosOrder(models.Model):
    _inherit = 'pos.order'

    def action_invoice_to_customer(self, name=None, client=None):
        self.ensure_one()

        report = self.env.ref('customize_point_sale.pos_invoice_report_imagen').render_qweb_pdf(self.ids)
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